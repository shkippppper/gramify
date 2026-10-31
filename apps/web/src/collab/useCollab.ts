import { HocuspocusProvider } from '@hocuspocus/provider';
import { colorForId, docNameFor, type PresenceState, type PublicUser } from '@tidepool/shared';
import { useEffect, useState } from 'react';
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
  readOnly = false,
): CollabState {
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
    };
    for (const [k, v] of Object.entries(presence)) awareness.setLocalStateField(k, v);

    const session = sessionFromDoc(doc, awareness, readOnly);
    setState({ session, provider, status: 'connecting', synced: false, unsynced: 0, error: null });

    provider.on('status', ({ status }: { status: CollabStatus }) =>
      setState((s) => ({ ...s, status })),
    );
    provider.on('synced', ({ state: synced }: { state: boolean }) =>
      setState((s) => ({ ...s, synced })),
    );
    provider.on('unsyncedChanges', ({ number }: { number: number }) =>
      setState((s) => ({ ...s, unsynced: number })),
    );
    // The server decides access; follow it if the owner changes our role mid-session.
    provider.on('authenticated', ({ scope }: { scope: 'read-write' | 'readonly' }) =>
      setState((s) => {
        const ro = scope === 'readonly';
        return s.session && s.session.readOnly !== ro
          ? { ...s, session: { ...s.session, readOnly: ro } }
          : s;
      }),
    );
    provider.on('authenticationFailed', ({ reason }: { reason: string }) =>
      setState((s) => ({ ...s, error: reason || 'You do not have access to this diagram.' })),
    );

    // Clear our presence promptly when the tab closes.
    const onUnload = () => awareness.setLocalState(null);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();
    };
  }, [diagramId, me?.id, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/** Remote peers (excluding ourselves), one entry per connected client. */
export function remotePeers(session: DiagramSession | null): Array<[number, PresenceState]> {
  const aw = session?.awareness;
  if (!aw) return [];
  const out: Array<[number, PresenceState]> = [];
  aw.getStates().forEach((st, id) => {
    if (id !== aw.clientID && (st as Partial<PresenceState>).user)
      out.push([id, st as PresenceState]);
  });
  return out;
}
