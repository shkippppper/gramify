/**
 * Sticky participants for sequence diagrams.
 *
 * In a long sequence diagram the participant boxes at the top scroll out of view, and it gets
 * hard to tell which lifeline you are looking at. This keeps copies of them pinned to the top
 * of the preview: each copy stays centred over its own lifeline as you pan and zoom, and the
 * band hides again while the real boxes (top or bottom) are on screen.
 */

const NS = 'http://www.w3.org/2000/svg';
/** Space above and below the boxes inside the band, in px. */
const PAD = 6;
/** The copies are never drawn taller than this, so a deep zoom doesn't cover the screen. */
const MAX_BOX_PX = 56;

export interface StickyActors {
  /**
   * Re-position after a pan, zoom or resize. `pan` and `zoom` come from the pan/zoom state
   * (svg-pan-zoom writes them to the DOM a frame later, so the DOM can lag behind).
   */
  update(pan: { x: number; y: number }, zoom: number): void;
}

/**
 * Builds the sticky band for `src` (a rendered, pan/zoomable mermaid SVG) inside `host`.
 * Returns null, leaving `host` empty, when the diagram has no participants.
 */
export function mountStickyActors(src: SVGSVGElement, host: HTMLElement): StickyActors | null {
  host.replaceChildren();
  host.dataset.show = 'false';
  const viewport = src.querySelector<SVGGElement>('.svg-pan-zoom_viewport');
  if (!viewport) return null;
  const tops = [...viewport.querySelectorAll<SVGGraphicsElement>('.actor-top')];
  if (!tops.length) return null;

  // A participant is drawn as a group (box + label); stick figures carry the class themselves.
  const sources = new Set<SVGGraphicsElement>();
  for (const el of tops) {
    const parent = el.parentNode as SVGGraphicsElement | null;
    const owner = el.tagName.toLowerCase() === 'g' || !parent || parent === viewport ? el : parent;
    sources.add(owner);
  }

  const id = `${src.id || 'tp-diagram'}-sticky`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', id);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('aria-hidden', 'true');
  const cls = src.getAttribute('class');
  if (cls) svg.setAttribute('class', cls);
  // Mermaid scopes its styles to the diagram's id; re-scope them to the copy.
  const style = src.querySelector('style');
  if (style?.textContent) {
    const s = document.createElementNS(NS, 'style');
    s.textContent = src.id
      ? style.textContent.replaceAll(`#${src.id}`, `#${id}`)
      : style.textContent;
    svg.append(s);
  }
  // Gradients, filters and icons some participant shapes use.
  for (const defs of src.querySelectorAll('defs')) svg.append(defs.cloneNode(true));

  const viewportInverse = viewport.getCTM()?.inverse();
  const items: { pos: SVGGElement; cx: number }[] = [];
  for (const source of sources) {
    const pos = document.createElementNS(NS, 'g');
    // Keep any transforms between the pan/zoom viewport and the participant.
    const ctx = document.createElementNS(NS, 'g');
    const parentCtm = (source.parentElement as unknown as SVGGraphicsElement | null)?.getCTM?.();
    if (viewportInverse && parentCtm) {
      const m = viewportInverse.multiply(parentCtm);
      ctx.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
    }
    const copy = source.cloneNode(true) as SVGGraphicsElement;
    copy.querySelectorAll('.actor-line, .actor-bottom').forEach((n) => n.remove());
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    ctx.append(copy);
    pos.append(ctx);
    svg.append(pos);
    items.push({ pos, cx: 0 });
  }
  host.append(svg);

  // Measure in diagram coordinates (the host is invisible, not display:none, so this works).
  let top = Infinity;
  let bottom = -Infinity;
  for (const item of items) {
    const b = item.pos.getBBox();
    if (!b.width && !b.height) continue;
    top = Math.min(top, b.y);
    bottom = Math.max(bottom, b.y + b.height);
    item.cx = b.x + b.width / 2;
  }
  if (!Number.isFinite(top) || bottom <= top) {
    host.replaceChildren();
    return null;
  }
  const bandH = bottom - top;
  // Where the mirrored boxes at the bottom start (mermaid draws them by default).
  const bottomYs = [...viewport.querySelectorAll<SVGGraphicsElement>('.actor-bottom')].map((e) => {
    const b = e.getBBox();
    const m =
      e.parentNode === viewport
        ? null
        : (e.parentElement as unknown as SVGGraphicsElement).getCTM();
    return viewportInverse && m
      ? new DOMPoint(b.x, b.y).matrixTransform(viewportInverse.multiply(m)).y
      : b.y;
  });
  const end = bottomYs.length ? Math.min(...bottomYs) : Infinity;

  return {
    update(pan, zoom) {
      if (!src.isConnected) return;
      const z = zoom;
      const e = pan.x;
      const f = pan.y;
      const scale = Math.min(z, MAX_BOX_PX / bandH);
      const height = bandH * scale + PAD * 2;
      for (const { pos, cx } of items) {
        pos.setAttribute(
          'transform',
          `translate(${cx * z + e} ${PAD}) scale(${scale}) translate(${-cx} ${-top})`,
        );
      }
      host.style.height = `${height}px`;
      // Show once the real boxes are half off-screen, until the bottom boxes reach the band.
      const show = (top + bandH / 2) * z + f < 0 && end * z + f > height;
      host.dataset.show = String(show);
    },
  };
}
