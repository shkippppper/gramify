import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/theme';
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
  const { dark } = useTheme();
  const key = `${dark ? 'd' : 'l'}\u0000${config}\u0000${code}`;
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
    renderDiagram(code, cfg.ok ? cfg.config : {}, { dark }).then((res) => {
      const url = res.ok ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(res.svg)}` : null;
      cache.set(key, url);
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, key, code, config, dark]);

  return (
    <div ref={ref} className={className}>
      {src ? (
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          draggable={false}
        />
      ) : src === null ? (
        <div className="grid size-full place-items-center text-xs text-muted">Syntax error</div>
      ) : (
        <div className="size-full animate-pulse rounded bg-surface-2" />
      )}
    </div>
  );
}
