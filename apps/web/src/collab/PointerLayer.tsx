import type { PresenceState } from '@tidepool/shared';
import type { PreviewApi } from '../render/Preview';
import { useAwarenessStates, type DiagramSession } from './session';
import { remotePeers } from './useCollab';

/** Live mouse pointers of teammates over the diagram, in diagram coordinates. */
export function PointerLayer({ session, api }: { session: DiagramSession; api: PreviewApi }) {
  useAwarenessStates<PresenceState>(session.awareness);
  void api.version; // re-render on pan/zoom
  return (
    <>
      {remotePeers(session).map(([id, st]) => {
        if (!st.pointer) return null;
        const p = api.fromNormalized(st.pointer.x, st.pointer.y);
        if (!p) return null;
        return (
          <div
            key={id}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            data-testid="remote-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow" aria-hidden>
              <path
                d="M2 1.5 L15.5 8.2 L9.2 9.6 L6.4 15.6 Z"
                fill={st.user.color}
                stroke="white"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute top-4 left-3 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow"
              style={{ background: st.user.color }}
            >
              {st.user.name.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </>
  );
}
