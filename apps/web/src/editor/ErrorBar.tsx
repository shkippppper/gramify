import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiagramError } from '../render/useDiagramRender';

/** Shows the current syntax error after a short delay so it doesn't flicker while typing. */
export function ErrorBar({ error, delay = 1500 }: { error: DiagramError | null; delay?: number }) {
  const [shown, setShown] = useState<DiagramError | null>(null);
  useEffect(() => {
    if (!error) {
      setShown(null);
      return;
    }
    const t = setTimeout(() => setShown(error), shown ? 0 : delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, delay]);
  if (!shown) return null;
  return (
    <div
      role="alert"
      data-testid="error-bar"
      className="max-h-40 overflow-auto border-t border-danger/30 bg-danger/8 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-danger"
    >
      <div className="mb-1 flex items-center gap-1.5 font-sans font-semibold">
        <AlertTriangle size={14} /> {shown.source === 'config' ? 'Config error' : 'Syntax error'}
      </div>
      {shown.message}
    </div>
  );
}
