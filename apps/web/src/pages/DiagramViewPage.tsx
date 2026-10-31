import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useYMapValue, useYText, type DiagramSession } from '../collab/session';
import { useCollab } from '../collab/useCollab';
import { FullPageSpinner, useMe } from '../lib/auth';
import { DiagramView } from './ViewPage';

function LiveView({ session }: { session: DiagramSession }) {
  const code = useYText(session.code);
  const config = useYText(session.config);
  const title = useYMapValue<string>(session.meta, 'title');
  useEffect(() => {
    if (title) document.title = `${title} · Gramify`;
  }, [title]);
  return <DiagramView code={code} config={config} />;
}

/** Full-screen, live-updating view of a shared diagram (great for presenting). */
export function DiagramViewPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const collab = useCollab(id, me.data);
  if (collab.error)
    return <div className="grid h-full place-items-center text-sm text-danger">{collab.error}</div>;
  if (!collab.session || !collab.synced) return <FullPageSpinner />;
  return <LiveView session={collab.session} />;
}
