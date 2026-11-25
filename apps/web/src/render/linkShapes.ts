import { parseMermaidId, type Candidates } from './locate';

/**
 * Find the shapes a `%% link <shape> -> …` line refers to in a rendered mermaid SVG.
 * `<shape>` may be an id from the code (participant / node / class / state id) or the shape's
 * visible label; ids match exactly, labels ignore case and spacing.
 */

/** Containers that represent one shape (what gets the link, the badge and the click). */
const SHAPE_SELECTOR = [
  'g.node',
  'g.cluster',
  'g.actor-man',
  'g.mindmap-node',
  'g.timeline-node',
  'g.architecture-service',
  'g.architecture-group',
  'g.task',
  'g.section',
  'g.note',
].join(',');

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The ids a shape container carries (render prefix stripped). */
function shapeIds(el: Element, prefix: string): string[] {
  const out: Candidates = { ids: [], edges: [], texts: [] };
  const name = el.getAttribute('name');
  if (name) out.ids.push(name);
  for (const raw of [el.getAttribute('data-id'), el.id]) {
    if (!raw) continue;
    parseMermaidId(prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw, out);
  }
  return out.ids;
}

/** Every shape in the diagram with the keys it can be linked by. */
export function linkableShapes(
  svg: SVGSVGElement,
): { el: Element; ids: string[]; label: string }[] {
  const prefix = svg.id ? `${svg.id}-` : '';
  const out: { el: Element; ids: string[]; label: string }[] = [];
  const seen = new Set<Element>();
  const add = (el: Element, ids: string[], label: string) => {
    if (seen.has(el)) return;
    seen.add(el);
    out.push({ el, ids, label });
  };
  // Sequence participants: <rect class="actor actor-top" name="W"> next to <text>Worker</text>.
  for (const rect of svg.querySelectorAll('rect.actor[name]')) {
    const box = rect.parentElement;
    if (!box) continue;
    const text = box.querySelector('text.actor');
    add(box, [rect.getAttribute('name')!], norm(text?.textContent));
  }
  for (const el of svg.querySelectorAll(SHAPE_SELECTOR)) {
    add(el, shapeIds(el, prefix), norm(el.textContent));
  }
  return out;
}

/** Shapes matching a link's `<shape>` key: ids first, then labels. */
export function findLinkShapes(svg: SVGSVGElement, key: string): Element[] {
  const shapes = linkableShapes(svg);
  const byId = shapes.filter((s) => s.ids.includes(key));
  if (byId.length) return byId.map((s) => s.el);
  const want = norm(key);
  return shapes.filter((s) => s.label === want).map((s) => s.el);
}

/** The id (or label) to write in a link line for a shape the user picked. */
export function linkKeyFor(shape: Element, svg: SVGSVGElement): string | null {
  const found = linkableShapes(svg).find((s) => s.el === shape || s.el.contains(shape));
  if (!found) return null;
  return (
    found.ids[0] ?? (found.label ? (found.el.textContent ?? '').replace(/\s+/g, ' ').trim() : null)
  );
}

/** The shape container around a clicked element, if it is a linkable shape. */
export function shapeAt(target: Element, svg: SVGSVGElement): Element | null {
  const shapes = linkableShapes(svg);
  for (let el: Element | null = target; el && el !== svg; el = el.parentElement) {
    if (shapes.some((s) => s.el === el)) return el;
  }
  return null;
}

/** What the preview needs to know about a `%% link` line. */
export interface ShapeLink {
  shape: string;
  /** Absolute URL to open, or null when the link couldn't be resolved. */
  href: string | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// lucide "link" glyph (24×24).
const LINK_GLYPH = [
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
  'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
];

/**
 * Mark the linked shapes in the live preview: `data-tp-link=<index>`, a pointer cursor and a
 * small link badge at the shape's top-right corner. Clears earlier marks first.
 */
export function decorateLinks(svg: SVGSVGElement, links: ShapeLink[]) {
  svg.querySelectorAll('.tp-link-badge').forEach((n) => n.remove());
  svg.querySelectorAll('[data-tp-link]').forEach((n) => {
    n.removeAttribute('data-tp-link');
    n.classList.remove('tp-linked', 'tp-link-broken');
  });
  links.forEach((link, i) => {
    for (const el of findLinkShapes(svg, link.shape)) {
      if (el.hasAttribute('data-tp-link')) continue; // the first line for a shape wins
      el.setAttribute('data-tp-link', String(i));
      el.classList.add('tp-linked');
      if (!link.href) el.classList.add('tp-link-broken');
      let box: DOMRect;
      try {
        box = (el as SVGGraphicsElement).getBBox();
      } catch {
        continue;
      }
      if (!box.width && !box.height) continue;
      const badge = document.createElementNS(SVG_NS, 'g');
      badge.setAttribute('class', 'tp-link-badge');
      badge.setAttribute('transform', `translate(${box.x + box.width} ${box.y})`);
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('r', '8');
      badge.append(circle);
      const icon = document.createElementNS(SVG_NS, 'g');
      icon.setAttribute('transform', 'translate(-5.4 -5.4) scale(0.45)');
      for (const d of LINK_GLYPH) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        icon.append(p);
      }
      badge.append(icon);
      el.append(badge);
    }
  });
}

/** Wrap linked shapes in `<a>` so they stay clickable in an exported SVG. */
export function linkifySvgMarkup(markup: string, links: ShapeLink[]): string {
  const usable = links.filter((l) => l.href);
  if (!usable.length) return markup;
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (doc.querySelector('parsererror') || svg.tagName.toLowerCase() !== 'svg') return markup;
  const done = new Set<Element>();
  for (const link of usable) {
    for (const el of findLinkShapes(svg, link.shape)) {
      if (done.has(el) || !el.parentNode) continue;
      done.add(el);
      const a = doc.createElementNS(SVG_NS, 'a');
      a.setAttribute('href', link.href!);
      a.setAttribute('target', '_blank');
      el.parentNode.insertBefore(a, el);
      a.append(el);
    }
  }
  return new XMLSerializer().serializeToString(svg);
}
