import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';
import type { MermaidConfig } from 'mermaid';
import mermaid from 'mermaid';
import { findErrorLine, normalizeErrorMessage } from './errors';

mermaid.registerLayoutLoaders(tidyTreeLayouts);
const ready = mermaid.registerExternalDiagrams([zenuml]);

export const MERMAID_VERSION: string =
  (mermaid as unknown as { version?: string }).version ??
  (mermaid.mermaidAPI.getConfig() as { version?: string }).version ??
  '12.2.0';

export const defaultMermaidConfig = (mermaid.mermaidAPI.defaultConfig ?? {}) as Record<
  string,
  unknown
>;

// ---- Config handling -------------------------------------------------------

/** Keys a document must never be able to set (mermaid's own `secure` list + ours). */
const FORBIDDEN_KEYS = new Set([
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'maxEdges',
  'suppressErrorRendering',
  'dompurifyConfig',
  '__proto__',
  'constructor',
  'prototype',
]);

/** Strip dangerous keys and HTML-ish string values from a user config, recursively. */
export function sanitizeConfig(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) return value.map((v) => sanitizeConfig(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k) || k.startsWith('__')) continue;
      const clean = sanitizeConfig(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  if (typeof value === 'string' && /[<>]|url\(\s*['"]?\s*(data|javascript):/i.test(value)) {
    return undefined;
  }
  return value;
}

export type ConfigResult = { ok: true; config: MermaidConfig } | { ok: false; error: string };

export function parseConfig(json: string): ConfigResult {
  if (!json.trim()) return { ok: true, config: {} };
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Config must be a JSON object' };
    }
    return { ok: true, config: sanitizeConfig(parsed) as MermaidConfig };
  } catch (e) {
    return { ok: false, error: `Config JSON: ${(e as Error).message}` };
  }
}

// ---- Theme management (local only; never written into the shared doc) -----

const SECTION_ALIASES: Record<string, string> = {
  classDiagram: 'class',
  'flowchart-elk': 'flowchart',
  'flowchart-v2': 'flowchart',
  railroadAbnf: 'railroad',
  railroadEbnf: 'railroad',
  railroadPeg: 'railroad',
  stateDiagram: 'state',
  xychart: 'xyChart',
};

const themeOf = (section: unknown) =>
  section && typeof section === 'object' && typeof (section as { theme?: unknown }).theme === 'string'
    ? ((section as { theme: string }).theme as string)
    : undefined;

const globalDefaultTheme = (defaultMermaidConfig.theme as string | undefined) ?? 'default';

export function defaultThemeFor(diagramType: string | undefined) {
  if (!diagramType) return globalDefaultTheme;
  const key = SECTION_ALIASES[diagramType] ?? diagramType;
  return themeOf(defaultMermaidConfig[key]) ?? globalDefaultTheme;
}

export const darkVariantOf = (theme: string) =>
  theme.includes('dark') ? theme : theme.startsWith('redux') ? theme.replace('redux', 'redux-dark') : 'dark';

const managedThemes = new Set<string>();
for (const t of [globalDefaultTheme, ...Object.values(defaultMermaidConfig).map(themeOf)]) {
  if (t) {
    managedThemes.add(t);
    managedThemes.add(darkVariantOf(t));
  }
}
/** The editor may swap a theme the user did not deliberately choose. */
export const isManagedTheme = (theme: unknown) =>
  theme === undefined || (typeof theme === 'string' && managedThemes.has(theme));

/** Effective config for rendering: the user's config + local dark-mode theme swap. */
export function effectiveConfig(config: MermaidConfig, diagramType: string | undefined, dark: boolean) {
  const out: MermaidConfig = { ...config, startOnLoad: false, securityLevel: 'strict' };
  if (isManagedTheme(config.theme)) {
    const base = defaultThemeFor(diagramType);
    out.theme = (dark ? darkVariantOf(base) : base) as MermaidConfig['theme'];
  }
  return out;
}

// ---- Rendering -------------------------------------------------------------

export interface RenderSuccess {
  ok: true;
  svg: string;
  diagramType: string;
  bindFunctions?: (el: Element) => void;
  ms: number;
}
export interface RenderFailure {
  ok: false;
  error: string;
  line: number | null;
  diagramType?: string;
}
export type RenderResult = RenderSuccess | RenderFailure;

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

/** mermaid.render is not re-entrant; serialize every call through one queue. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function detectType(code: string): Promise<string | undefined> {
  await ready;
  try {
    const res = await mermaid.parse(code, { suppressErrors: true });
    return res ? res.diagramType : undefined;
  } catch {
    return undefined;
  }
}

export function renderDiagram(
  code: string,
  config: MermaidConfig,
  opts: { dark: boolean },
): Promise<RenderResult> {
  return enqueue(async () => {
    await ready;
    const started = performance.now();
    let diagramType: string | undefined;
    try {
      // Initialize with base config first so parse honours e.g. securityLevel.
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const parsed = await mermaid.parse(code);
      diagramType = parsed ? parsed.diagramType : undefined;
      mermaid.initialize(effectiveConfig(config, diagramType, opts.dark));
      const id = `tp-render-${++counter}`;
      const { svg, bindFunctions, diagramType: dt } = await mermaid.render(id, code);
      return {
        ok: true as const,
        svg,
        diagramType: dt ?? diagramType ?? 'unknown',
        bindFunctions,
        ms: performance.now() - started,
      };
    } catch (e) {
      const raw = errorText(e);
      const line = findErrorLine(raw, code, e);
      // mermaid may leave a temp error element in the body on failure.
      document.querySelectorAll('body > [id^="dtp-render-"]').forEach((n) => n.remove());
      return { ok: false as const, error: normalizeErrorMessage(raw, line), line, diagramType };
    }
  });
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'str' in e) return String((e as { str: unknown }).str);
  return String(e);
}

// ---- Docs links ------------------------------------------------------------

const DOCS: Record<string, string> = {
  flowchart: 'flowchart',
  'flowchart-v2': 'flowchart',
  'flowchart-elk': 'flowchart',
  graph: 'flowchart',
  sequence: 'sequenceDiagram',
  class: 'classDiagram',
  classDiagram: 'classDiagram',
  state: 'stateDiagram',
  stateDiagram: 'stateDiagram',
  er: 'entityRelationshipDiagram',
  journey: 'userJourney',
  gantt: 'gantt',
  pie: 'pie',
  quadrantChart: 'quadrantChart',
  requirement: 'requirementDiagram',
  gitGraph: 'gitgraph',
  c4: 'c4',
  mindmap: 'mindmap',
  timeline: 'timeline',
  zenuml: 'zenuml',
  sankey: 'sankey',
  xychart: 'xyChart',
  block: 'block',
  packet: 'packet',
  kanban: 'kanban',
  architecture: 'architecture',
  radar: 'radar',
  treemap: 'treemap',
};

export function docsUrlFor(diagramType: string | undefined) {
  const slug = diagramType ? DOCS[diagramType] : undefined;
  return slug ? `https://mermaid.js.org/syntax/${slug}.html` : 'https://mermaid.js.org/intro/';
}
