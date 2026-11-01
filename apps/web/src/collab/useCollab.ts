import { HocuspocusProvider } from '@hocuspocus/provider';
import { colorForId, docNameFor, type PresenceState, type PublicUser } from '@gramify/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { sessionFromDoc, type DiagramSession } from './session';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabState {
  session: DiagramSession | null;
  provider: HocuspocusProvider | null;
  status: CollabStatus;
  /** True once the initial document state arrived from the server. */
  synced: boolean;
  unsynced: number;
  error: string | null;
}

function collabUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/collab`;
}

/** Connect to a diagram's shared Y.Doc and publish our presence. */
export function useCollab(
  diagramId: string | undefined,
  me: PublicUser | null | undefined,
  opts: { readOnly?: boolean; mode?: 'edit' | 'view' } = {},
): CollabState {
  const qc = useQueryClient();
  // Only the initial guess: the server's auth scope decides afterwards (see 'authenticated').
  const initialReadOnly = useRef(!!opts.readOnly);
  initialReadOnly.current = !!opts.readOnly;
  const mode = opts.mode ?? 'edit';
  const [state, setState] = useState<CollabState>({
    session: null,
    provider: null,
    status: 'connecting',
    synced: false,
    unsynced: 0,
    error: null,
  });

  useEffect(() => {
    if (!diagramId || !me) return;
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabUrl(),
      name: docNameFor(diagramId),
      document: doc,
    });
    const awareness = provider.awareness!;
    const presence: Partial<PresenceState> = {
      user: {
        id: me.id,
        name: me.name,
        email: me.email,
        image: me.image,
        color: colorForId(me.id),
      },
      pointer: null,
      tab: 'code',
      view: null,
      mode,
    };
    for (const [k, v] of Object.entries(presence)) awareness.setLocalStateField(k, v);

    const session = sessionFromDoc(doc, awareness, initialReadOnly.current);
    let unsynced = 0;
    setState({ session, provider, status: 'connecting', synced: false, unsynced: 0, error: null });

    provider.on('status', ({ status }: { status: CollabStatus }) =>
      setState((s) => ({ ...s, status })),
    );
    provider.on('synced', ({ state: synced }: { state: boolean }) => {
      setState((s) => ({ ...s, synced }));
      // After any (re)connect, re-announce our presence with a fresh clock: the server
      // dropped our state when the old socket closed and ignores a resend of the same clock,
      // which would leave us invisible to others until we next move the pointer.
      if (synced) {
        const local = awareness.getLocalState();
        if (local) awareness.setLocalState({ ...local });
      }
    });
    provider.on('unsyncedChanges', ({ number }: { number: number }) => {
      unsynced = number;
      setState((s) => ({ ...s, unsynced: number }));
    });
    // The server decides access; follow it if the owner changes our role mid-session.
    provider.on('authenticated', ({ scope }: { scope: 'read-write' | 'readonly' }) =>
      setState((s) => {
        const ro = scope === 'readonly';
        if (!s.session || s.session.readOnly === ro) return s;
        // Refresh the board's REST summary too, so badges/History agree with the editor.
        void qc.invalidateQueries({ queryKey: ['diagram', diagramId] });
        return { ...s, session: { ...s.session, readOnly: ro } };
      }),
    );
    provider.on('authenticationFailed', ({ reason }: { reason: string }) =>
      setState((s) => ({ ...s, error: reason || 'You do not have access to this diagram.' })),
    );

    // Warn before closing with edits that haven't reached the server; otherwise clear presence.
    const onUnload = (e: BeforeUnloadEvent) => {
      if (unsynced > 0) {
        e.preventDefault();
        return;
      }
      awareness.setLocalState(null);
    };
    window.addEventListener('beforeunload', onUnload);
    // After a display-name change, reconnect so the server stamps the new name on our presence.
    const onIdentity = () => {
      // Drop just the socket; the provider's auto-reconnect re-authenticates with the
      // refreshed session (disconnect()+connect() races: connect() sees the socket still open).
      provider.configuration.websocketProvider.webSocket?.close();
    };
    window.addEventListener('tp:identity-changed', onIdentity);

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('tp:identity-changed', onIdentity);
      awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();
    };
  }, [diagramId, me?.id, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/** Remote peers (excluding ourselves), one entry per connected client. */
export function remotePeers(session: DiagramSession | null): Array<[number, PresenceState]> {
  const aw = session?.awareness;
  if (!aw) return [];
  const out: Array<[number, PresenceState]> = [];
  aw.getStates().forEach((st, id) => {
    const p = st as Partial<PresenceState> & { mode?: string };
    // Full-screen viewers aren't editing (and have nothing to follow).
    if (id !== aw.clientID && p.user && p.mode !== 'view') out.push([id, st as PresenceState]);
  });
  return out;
}
