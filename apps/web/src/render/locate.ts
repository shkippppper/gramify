/**
 * Click-to-code: map an element of a rendered mermaid SVG back to the line of
 * source that defines it.
 *
 * Mermaid gives most shapes an id derived from the identifier in the code
 * (e.g. `<svgId>-flowchart-A-0` for node `A`, `<svgId>-L_A_B_0` for the edge
 * A→B, `<svgId>-classId-Animal-4`, `<svgId>-state-Still-3`, `entity-CUSTOMER-0`,
 * `service-db`, sequence actors carry `data-id="John"`). Where no identifier is
 * available (pie slices, mindmap/timeline nodes, message texts) we fall back to
 * searching for the visible label text.
 */

export interface Candidates {
  /** Identifiers that may be defined in the code, most specific first. */
  ids: string[];
  /** Possible edge endpoints (from → to). */
  edges: Array<[string, string]>;
  /** Visible label texts, most specific first. */
  texts: string[];
}

export interface CodeRange {
  line: number; // 1-based
  startColumn: number; // 1-based, inclusive
  endColumn: number; // 1-based, exclusive
}

const ID_PREFIXES = [
  'flowchart-',
  'classId-',
  'state-',
  'entity-',
  'service-',
  'group-',
  'junction-',
  'node-',
  'task-',
  'section-',
];
const STRUCTURAL = new Set([
  'root',
  'node',
  'edge',
  'label',
  'cluster',
  'default',
  'undefined',
  'null',
]);

/** Turn one (render-prefix-stripped) element id / data-id into candidates. */
export function parseMermaidId(raw: string, out: Candidates) {
  const id = raw.trim();
  if (!id) return;
  // ER edge: id_entity-CUSTOMER-0_entity-ORDER-1_0
  const er = [...id.matchAll(/entity-(.+?)-\d+/g)].map((m) => m[1]!);
  if (er.length >= 2) {
    out.edges.push([er[0]!, er[1]!]);
    return;
  }
  // Edges: L_A_B_0 (flowchart/architecture), id_A_B_1 (class), edge_0_1 (mindmap: no names).
  const edge = /^(?:L|id|LS|LE)_(.+)_\d+$/.exec(id);
  if (edge) {
    const parts = edge[1]!.split('_');
    // Identifiers may themselves contain underscores: try every split point.
    for (let i = 1; i < parts.length; i++)
      out.edges.push([parts.slice(0, i).join('_'), parts.slice(i).join('_')]);
    return;
  }
  if (/^edge_?\d/.test(id) || /^i\d+$/.test(id)) return;
  // Block diagram edges: <n>-from-to
  const block = /^\d+-(.+)$/.exec(id);
  if (block) {
    const parts = block[1]!.split('-');
    for (let i = 1; i < parts.length; i++)
      out.edges.push([parts.slice(0, i).join('-'), parts.slice(i).join('-')]);
    return;
  }
  let name = id;
  for (const p of ID_PREFIXES) {
    if (name.startsWith(p)) {
      name = name.slice(p.length);
      break;
    }
  }
  name = name.replace(/-\d+$/, ''); // trailing render counter
  if (name && !STRUCTURAL.has(name) && !/^\d+$/.test(name)) out.ids.push(name);
}

const clean = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

/** Collect candidates from the clicked element and its ancestors (up to the svg root). */
export function candidatesFromElement(target: Element, svg: SVGSVGElement): Candidates {
  const out: Candidates = { ids: [], edges: [], texts: [] };
  const prefix = svg.id ? `${svg.id}-` : '';
  const leafText = clean(target.textContent);
  if (leafText && leafText.length <= 200) out.texts.push(leafText);
  for (let el: Element | null = target; el && el !== svg; el = el.parentElement) {
    const dataId = el.getAttribute('data-id');
    if (dataId)
      parseMermaidId(
        prefix && dataId.startsWith(prefix) ? dataId.slice(prefix.length) : dataId,
        out,
      );
    if (el.id && prefix && el.id.startsWith(prefix)) {
      let rest = el.id.slice(prefix.length);
      if (rest.startsWith(prefix)) rest = rest.slice(prefix.length); // block edges repeat the prefix
      parseMermaidId(rest, out);
    }
    const cls = el.getAttribute('class') ?? '';
    // Stop at the first "shape" container; take its full label as a last-resort text.
    if (
      /\b(node|edgeLabel|cluster|actor|task|section|slice|legend|mindmap-node|timeline-node|architecture-service)\b/.test(
        cls,
      )
    ) {
      const t = clean(el.textContent);
      if (t && t.length <= 200 && !out.texts.includes(t)) out.texts.push(t);
      if (out.ids.length || out.edges.length) break;
    }
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (id: string) => new RegExp(`(^|[^\\w-])(${escapeRe(id)})(?=$|[^\\w-])`);
const isComment = (line: string) => /^\s*%%/.test(line);

/** How strongly a line looks like the *definition* of `id` (0 = not present). */
function definitionScore(line: string, id: string): { score: number; col: number } {
  const m = wordRe(id).exec(line);
  if (!m) return { score: 0, col: 0 };
  const col = m.index + m[1]!.length + 1;
  const after = line.slice(col - 1 + id.length);
  const before = line.slice(0, col - 1);
  let score = 1;
  if (/^\s*(\[|\(|\{|>|@\{|:::)/.test(after))
    score = 4; // A[label], A(label), A{...}, A:::class
  else if (/^\s*$/.test(before) && /^\s*:/.test(after))
    score = 4; // state/class: "Name : description"
  else if (
    /^\s*(participant|actor|class|state|service|group|junction|requirement|element|entity|section|title)\s+$/i.test(
      before,
    )
  )
    score = 4;
  else if (
    /\(\s*$/.test(before) &&
    /^\s*,/.test(after) &&
    !/\b(Bi)?Rel(_\w+)?\(\s*$|UpdateRel\w*\(\s*$/.test(before)
  ) {
    score = 4; // C4: Person(customerA, ...) but not Rel(customerA, ...)
  } else if (/^\s*$/.test(before)) score = 3; // line starts with the id
  return { score, col };
}

/**
 * Find the best source range for the candidates. When the clicked label text
 * appears on the matched line, select the text (what people usually want to edit)
 * rather than the identifier.
 */
export function locateInCode(code: string, c: Candidates): CodeRange | null {
  const found = locateRaw(code, c);
  if (!found) return null;
  const line = code.split('\n')[found.line - 1] ?? '';
  const label = c.texts[0];
  if (label && label.length <= 120) {
    const at = line.indexOf(label);
    if (at >= 0) return { line: found.line, startColumn: at + 1, endColumn: at + 1 + label.length };
  }
  return found;
}

function locateRaw(code: string, c: Candidates): CodeRange | null {
  const lines = code.split('\n');
  const usable = (i: number) => !isComment(lines[i]!);

  // 1. Identifiers: prefer the defining line.
  for (const id of c.ids) {
    let best: { line: number; score: number; col: number } | null = null;
    lines.forEach((text, i) => {
      if (!usable(i)) return;
      const s = definitionScore(text, id);
      if (s.score > (best?.score ?? 0)) best = { line: i + 1, score: s.score, col: s.col };
    });
    if (best) {
      const b = best as { line: number; col: number };
      return { line: b.line, startColumn: b.col, endColumn: b.col + id.length };
    }
  }

  // 2. Edges: a line mentioning both endpoints, preferring one with an arrow.
  for (const [from, to] of c.edges) {
    const a = wordRe(from);
    const b = wordRe(to);
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i]!;
      if (!usable(i) || !a.test(t) || !b.test(t)) continue;
      found = i;
      if (/--|->|\.\.|==|~~|<-|\|/.test(t)) break;
    }
    if (found >= 0) {
      const t = lines[found]!;
      const start = t.length - t.trimStart().length + 1;
      return { line: found + 1, startColumn: start, endColumn: t.trimEnd().length + 1 };
    }
  }

  // 3. Visible text: exact, then case-insensitive, then the first line of a multi-line label.
  const texts = c.texts
    .flatMap((t) => [t, t.slice(0, 60)])
    .filter((t, i, a) => t.length >= 1 && a.indexOf(t) === i);
  for (const ci of [false, true]) {
    for (const text of texts) {
      const needle = ci ? text.toLowerCase() : text;
      for (let i = 0; i < lines.length; i++) {
        if (!usable(i)) continue;
        const hay = ci ? lines[i]!.toLowerCase() : lines[i]!;
        const at = hay.indexOf(needle);
        if (at >= 0) return { line: i + 1, startColumn: at + 1, endColumn: at + 1 + text.length };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Code → diagram: which elements does a line of code define or mention?
// ---------------------------------------------------------------------------

/** Containers worth outlining (the whole shape rather than one inner path). */
const SHAPE =
  'g.node, g.cluster, g.edgeLabel, g.actor, g.architecture-service, g.c4-shape, rect.task, g.section, g.legend';

interface ElementIndex {
  names: Map<string, Element[]>;
  edges: Array<{ from: string; to: string; els: Element[] }>;
  texts: Array<{ text: string; el: Element }>;
}

const indexCache = new WeakMap<SVGSVGElement, ElementIndex>();

function push<K>(map: Map<K, Element[]>, key: K, el: Element) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(el)) list.push(el);
  } else map.set(key, [el]);
}

/** Build (once per rendered SVG) a lookup from code identifiers / edges / label texts to elements. */
export function indexDiagram(svg: SVGSVGElement): ElementIndex {
  const cached = indexCache.get(svg);
  if (cached) return cached;
  const prefix = svg.id ? `${svg.id}-` : '';
  const names = new Map<string, Element[]>();
  const edgeMap = new Map<string, { from: string; to: string; els: Element[] }>();
  const texts: ElementIndex['texts'] = [];
  for (const el of svg.querySelectorAll('[id], [data-id]')) {
    const raws: string[] = [];
    const dataId = el.getAttribute('data-id');
    if (dataId)
      raws.push(prefix && dataId.startsWith(prefix) ? dataId.slice(prefix.length) : dataId);
    if (el.id && prefix && el.id.startsWith(prefix)) {
      let rest = el.id.slice(prefix.length);
      if (rest.startsWith(prefix)) rest = rest.slice(prefix.length);
      raws.push(rest);
    }
    for (const raw of raws) {
      const c: Candidates = { ids: [], edges: [], texts: [] };
      parseMermaidId(raw, c);
      const target = el.closest(SHAPE) ?? el;
      for (const id of c.ids) push(names, id, target);
      for (const [from, to] of c.edges) {
        const key = `${from}\u0000${to}`;
        const entry = edgeMap.get(key) ?? { from, to, els: [] };
        if (!entry.els.includes(target)) entry.els.push(target);
        edgeMap.set(key, entry);
      }
    }
  }
  for (const el of svg.querySelectorAll(SHAPE)) {
    const t = clean(el.textContent);
    if (t && t.length <= 120) texts.push({ text: t, el });
  }
  // Leaf texts too (pie legends, sequence messages, timeline events…).
  for (const el of svg.querySelectorAll('text, foreignObject span, foreignObject p')) {
    const t = clean(el.textContent);
    if (t && t.length <= 120 && !el.closest(SHAPE)) texts.push({ text: t, el });
  }
  const index = { names, edges: [...edgeMap.values()], texts };
  indexCache.set(svg, index);
  return index;
}

const HEADER_RE =
  /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|C4\w+|quadrantChart|requirementDiagram|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|radar-beta|treemap(-beta)?)\b/;

/** Elements of `svg` defined or referenced by `line` (1-based) of `code`. */
export function elementsForLine(svg: SVGSVGElement, code: string, line: number): Element[] {
  const raw = code.split('\n')[line - 1];
  if (!raw || isComment(raw) || !raw.trim() || HEADER_RE.test(raw)) return [];
  const text = raw.replace(/%%.*$/, '');
  const index = indexDiagram(svg);
  const found = new Set<Element>();
  const has = (id: string) => wordRe(id).test(text);

  for (const [name, els] of index.names) if (has(name)) els.forEach((el) => found.add(el));
  const arrow = /--|->|\.\.|==|~~|<-|\|/.test(text);
  for (const e of index.edges)
    if (arrow && has(e.from) && has(e.to)) e.els.forEach((el) => found.add(el));
  // Visible labels written on this line (e.g. a sequence message). Short labels only count
  // when nothing else matched, to avoid lighting up every "A" or "OK" on the canvas.
  const fallback = !found.size;
  for (const { text: label, el } of index.texts) {
    if ((label.length >= 4 || (fallback && label.length >= 2)) && text.includes(label)) {
      found.add(el.closest(SHAPE) ?? el);
    }
  }
  // Keep only the outermost elements (avoid outlining a shape and its own label twice).
  return [...found].filter((el) => ![...found].some((o) => o !== el && o.contains(el)));
}
