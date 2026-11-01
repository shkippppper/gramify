import type { PresenceState } from '@gramify/shared';
import clsx from 'clsx';
import { Avatar } from '../components/ui';
import { useAwarenessStates, type DiagramSession } from './session';
import { remotePeers } from './useCollab';

/** Stack of everyone else in the diagram; clicking one follows them. */
export function PresenceAvatars({
  session,
  following,
  onFollow,
}: {
  session: DiagramSession;
  following: number | null;
  onFollow: (clientId: number | null) => void;
}) {
  useAwarenessStates<PresenceState>(session.awareness);
  // One avatar per user (a user may have several tabs open).
  const byUser = new Map<string, [number, PresenceState]>();
  // Skip our own other tabs/windows: following yourself isn't useful.
  const myId = (session.awareness?.getLocalState() as PresenceState | null)?.user?.id;
  for (const [id, st] of remotePeers(session)) {
    if (st.user.id !== myId && !byUser.has(st.user.id)) byUser.set(st.user.id, [id, st]);
  }
  const peers = [...byUser.values()];
  if (!peers.length) return null;
  const shown = peers.slice(0, 5);
  return (
    <div className="flex items-center -space-x-1.5" data-testid="presence">
      {shown.map(([id, st]) => (
        <button
          key={id}
          type="button"
          onClick={() => onFollow(following === id ? null : id)}
          className={clsx(
            'rounded-full transition-transform hover:z-10 hover:scale-110',
            following === id && 'z-10 scale-110',
          )}
          title={`${st.user.name} (${st.user.email}) · editing ${st.tab === 'config' ? 'config' : 'code'}\n${following === id ? 'Click to stop following' : 'Click to follow'}`}
          aria-label={`${following === id ? 'Stop following' : 'Follow'} ${st.user.name}`}
          aria-pressed={following === id}
        >
          <Avatar name={st.user.name} image={st.user.image} color={st.user.color} size={28} ring />
        </button>
      ))}
      {peers.length > shown.length && (
        <span className="z-0 grid size-7 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-2 ring-surface">
          +{peers.length - shown.length}
        </span>
      )}
    </div>
  );
}
