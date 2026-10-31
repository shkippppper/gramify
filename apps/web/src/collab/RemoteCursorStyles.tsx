import type { PresenceState } from '@tidepool/shared';
import type { DiagramSession } from './session';
import { remotePeers } from './useCollab';
import { useAwarenessStates } from './session';

const cssString = (s: string) => `"${s.replace(/["\\\n\r]/g, ' ').slice(0, 40)}"`;
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#888');

/** Per-client colours and name tags for y-monaco's remote selection decorations. */
export function RemoteCursorStyles({ session }: { session: DiagramSession }) {
  useAwarenessStates<PresenceState>(session.awareness);
  const css = remotePeers(session)
    .map(([id, st]) => {
      const color = safeColor(st.user.color);
      const name = st.user.name.split(' ')[0] ?? st.user.name;
      return `.yRemoteSelection-${id}{background:${color}33}
.yRemoteSelectionHead-${id}{border-left:2px solid ${color};margin-left:-1px}
.yRemoteSelectionHead-${id}::after{content:${cssString(name)};background:${color};color:#fff}`;
    })
    .join('\n');
  return <style>{css}</style>;
}
