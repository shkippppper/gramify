import { useEffect, useRef, useState } from 'react';
import { parseConfig, renderDiagram, type RenderSuccess } from './mermaid';

export interface DiagramError {
  source: 'code' | 'config';
  message: string;
  line: number | null;
}

export interface DiagramRenderState {
  /** Last successful render (kept while there is an error). */
  result: RenderSuccess | null;
  error: DiagramError | null;
  /** True while the latest input has not rendered yet. */
  pending: boolean;
}

const SLOW_RENDER_MS = 150;
const SLOW_DEBOUNCE_MS = 1000;

/**
 * Renders mermaid code reactively. Fast diagrams re-render on every change;
 * once a render takes >150ms we switch to a 1s debounce (like mermaid.live).
 */
export function useDiagramRender(
  code: string,
  configText: string,
  dark: boolean,
  /** Changing this discards the last good render (e.g. switching to a version preview). */
  resetKey = '',
): DiagramRenderState {
  const [state, setState] = useState<DiagramRenderState>({
    result: null,
    error: null,
    pending: true,
  });
  const slow = useRef(false);
  const seq = useRef(0);
  const lastKey = useRef(resetKey);
  if (lastKey.current !== resetKey) {
    lastKey.current = resetKey;
    // Don't show the previous source's diagram while (or if) the new one fails to render.
    setState({ result: null, error: null, pending: true });
  }

  useEffect(() => {
    const id = ++seq.current;
    setState((s) => (s.pending ? s : { ...s, pending: true }));
    const run = async () => {
      const cfg = parseConfig(configText);
      if (!cfg.ok) {
        if (id === seq.current) {
          setState((s) => ({
            ...s,
            pending: false,
            error: {
              source: 'config',
              message: cfg.error,
              line: configErrorLine(cfg.error, configText),
            },
          }));
        }
        return;
      }
      const res = await renderDiagram(code, cfg.config, { dark });
      if (id !== seq.current) return; // superseded
      if (res.ok) {
        slow.current = res.ms > SLOW_RENDER_MS;
        setState({ result: res, error: null, pending: false });
      } else {
        setState((s) => ({
          ...s,
          pending: false,
          error: { source: 'code', message: res.error, line: res.line },
        }));
      }
    };
    if (slow.current) {
      const t = setTimeout(run, SLOW_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }
    // Coalesce bursts of keystrokes into one frame.
    const raf = requestAnimationFrame(() => void run());
    return () => cancelAnimationFrame(raf);
  }, [code, configText, dark]);

  return state;
}

function configErrorLine(message: string, text: string): number | null {
  const pos = /position (\d+)/.exec(message);
  if (pos?.[1]) return text.slice(0, Number(pos[1])).split('\n').length;
  const line = /line (\d+)/.exec(message);
  return line?.[1] ? Number(line[1]) : null;
}
