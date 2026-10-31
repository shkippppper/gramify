import { deserializeState } from '@gramify/shared';
import { useMemo } from 'react';
import { useTheme } from '../lib/theme';
import { Preview } from '../render/Preview';
import { useDiagramRender } from '../render/useDiagramRender';

export function DiagramView({ code, config }: { code: string; config: string }) {
  const { dark } = useTheme();
  const { result, error } = useDiagramRender(code, config, dark);
  return (
    <div className="h-full">
      {error && !result ? (
        <div className="grid h-full place-items-center p-6 font-mono text-sm whitespace-pre-wrap text-danger">
          {error.message}
        </div>
      ) : (
        <Preview
          svg={result?.svg ?? null}
          bindFunctions={result?.bindFunctions}
          stale={false}
          rough={false}
          grid={false}
          chrome={false}
        />
      )}
    </div>
  );
}

/** Full-screen view of a playground link. */
export function PlaygroundViewPage() {
  const state = useMemo(() => {
    try {
      const s = deserializeState(location.hash.slice(1));
      return { code: s.code, config: s.mermaid };
    } catch {
      return { code: 'flowchart LR\n  A[Invalid or missing diagram link]', config: '{}' };
    }
  }, []);
  return <DiagramView code={state.code} config={state.config} />;
}
