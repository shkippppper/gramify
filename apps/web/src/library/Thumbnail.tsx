import { useEffect, useRef, useState } from 'react';
import { parseConfig, renderDiagram } from '../render/mermaid';

const cache = new Map<string, string | null>();

/** Lazily rendered, cached SVG preview shown as an <img> (isolated styles and ids). */
export function Thumbnail({
  code,
  config,
  className,
}: {
  code: string;
  config: string;
  className?: string;
}) {
  // Thumbnails always use the light diagram theme on a white frame: readable in both UI themes.
  const key = `${config}\u0000${code}`;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null | undefined>(() => cache.get(key));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), {
      rootMargin: '200px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (cache.has(key)) {
      setSrc(cache.get(key));
      return;
    }
    let cancelled = false;
    const cfg = parseConfig(config);
    renderDiagram(code, cfg.ok ? cfg.config : {}, { dark: false }).then((res) => {
      const url = res.ok ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(res.svg)}` : null;
      // A failed load after a redeploy isn't the diagram's fault: don't remember it.
      if (res.ok || !res.staleBuild) cache.set(key, url);
      if (!res.ok && res.staleBuild) {
        if (!cancelled) setSrc('stale');
        return;
      }
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, key, code, config]);

  return (
    <div ref={ref} className={className}>
      {src && src !== 'stale' ? (
        <img
          src={src}
          alt=""
          className="tp-fade size-full object-contain"
          loading="lazy"
          draggable={false}
        />
      ) : src === 'stale' ? (
        <div className="grid size-full place-items-center text-center text-xs text-muted">
          Reload to preview
        </div>
      ) : src === null ? (
        <div className="grid size-full place-items-center text-xs text-muted">Syntax error</div>
      ) : (
        <div className="size-full animate-pulse rounded bg-surface-2" />
      )}
    </div>
  );
}
