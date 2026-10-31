import clsx from 'clsx';
import Hammer from 'hammerjs';
import { Grid3x3, Maximize, Minus, PenLine, Plus, RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import svgPanZoom from 'svg-pan-zoom';
import { IconButton } from '../components/ui';
import { MERMAID_VERSION } from './mermaid';
import { sketchSvg } from './rough';

type PanZoom = SvgPanZoom.Instance;

/** A shareable description of what part of the diagram is on screen. */
export interface SharedView {
  /** Center of the visible area in normalized diagram coords (0..1). */
  cx: number;
  cy: number;
  /** Screen pixels per diagram unit. */
  scale: number;
}

export interface PreviewApi {
  /** Client (screen) coords → normalized diagram coords, or null if no diagram. */
  toNormalized(clientX: number, clientY: number): { x: number; y: number } | null;
  /** Normalized diagram coords → coords relative to the preview container. */
  fromNormalized(x: number, y: number): { x: number; y: number } | null;
  /** Bumps whenever pan/zoom/diagram changes (overlays re-render on it). */
  version: number;
}

export interface PreviewHandle {
  /** SVG markup of the current diagram as rendered (incl. hand-drawn), before pan/zoom. */
  getExportSvg(): string | null;
  getView(): SharedView | null;
  setView(view: SharedView): void;
}

interface Props {
  ref?: Ref<PreviewHandle>;
  svg: string | null;
  bindFunctions?: ((el: Element) => void) | undefined;
  stale: boolean;
  rough: boolean;
  grid: boolean;
  onToggleRough?: () => void;
  onToggleGrid?: () => void;
  fullscreenHref?: string;
  /** Called on every user-initiated pan/zoom. */
  onUserView?: (view: SharedView) => void;
  onPointer?: (p: { x: number; y: number } | null) => void;
  overlay?: (api: PreviewApi) => ReactNode;
  /** Hide toolbars (embed / view mode). */
  chrome?: boolean;
}

export function Preview({
  ref,
  svg,
  bindFunctions,
  stale,
  rough,
  grid,
  onToggleRough,
  onToggleGrid,
  fullscreenHref,
  onUserView,
  onPointer,
  overlay,
  chrome = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoom | null>(null);
  const svgElRef = useRef<SVGSVGElement | null>(null);
  const exportRef = useRef<string | null>(null);
  /** Original viewBox of the diagram (x, y, w, h) for coordinate normalization. */
  const boxRef = useRef<[number, number, number, number] | null>(null);
  const dirtyRef = useRef(false);
  const programmatic = useRef(false);
  const [version, setVersion] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const onUserViewRef = useRef(onUserView);
  onUserViewRef.current = onUserView;

  const fit = useCallback(() => {
    const pz = pzRef.current;
    if (!pz) return;
    programmatic.current = true;
    pz.resize();
    pz.fit();
    pz.center();
    pz.zoom(pz.getZoom() * 0.875); // leave room for the toolbars
    programmatic.current = false;
    dirtyRef.current = false;
    bump();
  }, [bump]);

  const getView = useCallback((): SharedView | null => {
    const pz = pzRef.current;
    const box = boxRef.current;
    const host = containerRef.current;
    if (!pz || !box || !host) return null;
    const { realZoom } = pz.getSizes();
    const pan = pz.getPan();
    const rect = host.getBoundingClientRect();
    const localX = (rect.width / 2 - pan.x) / realZoom;
    const localY = (rect.height / 2 - pan.y) / realZoom;
    return { cx: (localX - box[0]) / box[2], cy: (localY - box[1]) / box[3], scale: realZoom };
  }, []);

  const setView = useCallback(
    (view: SharedView) => {
      const pz = pzRef.current;
      const box = boxRef.current;
      const host = containerRef.current;
      if (!pz || !box || !host) return;
      programmatic.current = true;
      const { realZoom } = pz.getSizes();
      const base = realZoom / pz.getZoom();
      pz.zoom(Math.min(12, Math.max(0.2, view.scale / base)));
      const z = pz.getSizes().realZoom;
      const rect = host.getBoundingClientRect();
      const localX = box[0] + view.cx * box[2];
      const localY = box[1] + view.cy * box[3];
      pz.pan({ x: rect.width / 2 - localX * z, y: rect.height / 2 - localY * z });
      programmatic.current = false;
      dirtyRef.current = true;
      bump();
    },
    [bump],
  );

  useImperativeHandle(ref, () => ({ getExportSvg: () => exportRef.current, getView, setView }), [getView, setView]);

  // Place the SVG and (re)initialise pan/zoom whenever the diagram changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !svg) return;
    let cancelled = false;
    (async () => {
      const prev = pzRef.current;
      const keep = prev && dirtyRef.current ? getView() : null;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svg;
      let el = wrapper.querySelector('svg');
      if (!el) return;
      if (rough) {
        try {
          el = await sketchSvg(el);
          setRenderError(null);
        } catch (e) {
          setRenderError((e as Error).message);
        }
      }
      if (cancelled) return;
      exportRef.current = el.outerHTML;
      const vb = (el.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
      boxRef.current =
        vb.length === 4 && vb[2]! > 0 && vb[3]! > 0 ? (vb as [number, number, number, number]) : null;

      prev?.destroy();
      pzRef.current = null;
      host.replaceChildren(el);
      el.setAttribute('width', '100%');
      el.setAttribute('height', '100%');
      el.style.maxWidth = 'none';
      bindFunctions?.(el);
      svgElRef.current = el;
      if (!boxRef.current) {
        const b = el.getBBox();
        boxRef.current = [b.x, b.y, b.width || 1, b.height || 1];
      }

      let hammer: HammerManager | undefined;
      const pz = svgPanZoom(el, {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        dblClickZoomEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.2,
        maxZoom: 12,
        zoomScaleSensitivity: 0.25,
        onPan: () => {
          if (!programmatic.current) {
            dirtyRef.current = true;
            const v = getView();
            if (v) onUserViewRef.current?.(v);
          }
          bump();
        },
        onZoom: () => {
          if (!programmatic.current) {
            dirtyRef.current = true;
            const v = getView();
            if (v) onUserViewRef.current?.(v);
          }
          bump();
        },
        customEventsHandler: {
          haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
          init(options) {
            const instance = options.instance;
            let initialScale = 1;
            let px = 0;
            let py = 0;
            hammer = new Hammer(options.svgElement);
            hammer.get('pinch').set({ enable: true });
            const panBy = (e: HammerInput) => {
              instance.panBy({ x: e.deltaX - px, y: e.deltaY - py });
              px = e.deltaX;
              py = e.deltaY;
            };
            hammer.on('panstart panmove', (e) => {
              if (e.type === 'panstart') px = py = 0;
              panBy(e);
            });
            hammer.on('pinchstart pinchmove', (e) => {
              if (e.type === 'pinchstart') {
                initialScale = instance.getZoom();
                px = py = 0;
              }
              instance.zoomAtPoint(initialScale * e.scale, { x: e.center.x, y: e.center.y });
              panBy(e);
            });
          },
          destroy() {
            hammer?.destroy();
          },
        },
      });
      pzRef.current = pz;
      if (keep) setView(keep);
      else fit();
    })();
    return () => {
      cancelled = true;
    };
  }, [svg, rough, bindFunctions, fit, getView, setView, bump]);

  useEffect(
    () => () => {
      pzRef.current?.destroy();
      pzRef.current = null;
    },
    [],
  );

  // Keep the diagram fitted on resize until the user pans/zooms.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pz = pzRef.current;
      if (!pz) return;
      pz.resize();
      if (!dirtyRef.current) fit();
      else bump();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, bump]);

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const viewport = svgElRef.current?.querySelector<SVGGElement>('.svg-pan-zoom_viewport');
    const box = boxRef.current;
    const ctm = viewport?.getScreenCTM();
    if (!ctm || !box) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: (p.x - box[0]) / box[2], y: (p.y - box[1]) / box[3] };
  }, []);

  const fromNormalized = useCallback((x: number, y: number) => {
    const viewport = svgElRef.current?.querySelector<SVGGElement>('.svg-pan-zoom_viewport');
    const box = boxRef.current;
    const ctm = viewport?.getScreenCTM();
    const host = containerRef.current;
    if (!ctm || !box || !host) return null;
    const p = new DOMPoint(box[0] + x * box[2], box[1] + y * box[3]).matrixTransform(ctm);
    const r = host.getBoundingClientRect();
    return { x: p.x - r.left, y: p.y - r.top };
  }, []);

  const onPointerRef = useRef(onPointer);
  onPointerRef.current = onPointer;
  const lastSent = useRef(0);

  return (
    <div
      ref={containerRef}
      className={clsx('tp-preview relative h-full w-full overflow-hidden bg-surface', grid && 'tp-grid-bg')}
      data-testid="preview"
      onPointerMove={(e) => {
        if (!onPointerRef.current) return;
        const now = performance.now();
        if (now - lastSent.current < 33) return; // ~30Hz
        lastSent.current = now;
        onPointerRef.current(toNormalized(e.clientX, e.clientY));
      }}
      onPointerLeave={() => onPointerRef.current?.(null)}
    >
      <div
        ref={hostRef}
        className={clsx('absolute inset-0 transition-opacity', stale && 'opacity-50')}
        data-testid="diagram"
      />
      {!svg && !stale && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">Rendering…</div>
      )}
      {overlay && <div className="pointer-events-none absolute inset-0">{overlay({ toNormalized, fromNormalized, version })}</div>}
      {renderError && (
        <div className="absolute left-3 top-3 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{renderError}</div>
      )}
      {chrome && (
        <>
          <div className="absolute right-3 top-3 flex gap-1 rounded-lg border border-border bg-surface/90 p-1 shadow-sm backdrop-blur">
            <IconButton label="Reset view" onClick={fit}>
              <RotateCcw size={16} />
            </IconButton>
            <IconButton label="Zoom out" onClick={() => pzRef.current?.zoomOut()}>
              <Minus size={16} />
            </IconButton>
            <IconButton label="Zoom in" onClick={() => pzRef.current?.zoomIn()}>
              <Plus size={16} />
            </IconButton>
            {fullscreenHref && (
              <a
                href={fullscreenHref}
                target="_blank"
                rel="noreferrer"
                title="Full screen"
                aria-label="Full screen"
                className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Maximize size={16} />
              </a>
            )}
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1 rounded-lg border border-border bg-surface/90 p-1 shadow-sm backdrop-blur">
            {onToggleRough && (
              <IconButton label="Hand-drawn" active={rough} onClick={onToggleRough}>
                <PenLine size={16} />
              </IconButton>
            )}
            {onToggleGrid && (
              <IconButton label="Background grid" active={grid} onClick={onToggleGrid}>
                <Grid3x3 size={16} />
              </IconButton>
            )}
          </div>
          <div className="absolute bottom-3 right-3 rounded bg-surface/80 px-2 py-0.5 font-mono text-[11px] text-muted">
            mermaid v{MERMAID_VERSION}
          </div>
        </>
      )}
    </div>
  );
}
