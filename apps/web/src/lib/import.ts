import { deserializeState } from '@gramify/shared';

/** Extract diagram code from a pasted mermaid.live link or raw mermaid code. */
export function parseImport(text: string): { code: string; config: string } {
  const t = text.trim();
  if (/^https?:\/\//.test(t) || t.startsWith('pako:') || t.startsWith('#pako:')) {
    const s = deserializeState(t);
    return { code: s.code, config: s.mermaid || '{}' };
  }
  return { code: t, config: '{}' };
}

/** Pull the first ```mermaid block out of Markdown, or treat the whole file as mermaid. */
export function parseFile(name: string, text: string): { code: string; title: string } {
  const title = name.replace(/\.(mmd|mermaid|md|markdown|txt)$/i, '') || 'Imported diagram';
  if (/\.(md|markdown)$/i.test(name)) {
    const m = /```mermaid\s*\n([\s\S]*?)```/.exec(text);
    if (!m?.[1]) throw new Error('No ```mermaid code block found in this Markdown file');
    return { code: m[1], title };
  }
  return { code: text, title };
}

/** A readable message for anything thrown while importing (some decoders throw strings). */
export function importErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (/incorrect header|invalid|unexpected|base64|json/i.test(raw) || !raw) {
    return 'That doesn’t look like a valid mermaid.live link. Copy the full URL from the address bar, or paste the Mermaid code itself.';
  }
  return raw;
}

const TYPE_NAMES: Record<string, string> = {
  flowchart: 'Flowchart',
  graph: 'Flowchart',
  sequenceDiagram: 'Sequence diagram',
  classDiagram: 'Class diagram',
  stateDiagram: 'State diagram',
  'stateDiagram-v2': 'State diagram',
  erDiagram: 'ER diagram',
  gantt: 'Gantt chart',
  pie: 'Pie chart',
  mindmap: 'Mindmap',
  timeline: 'Timeline',
  journey: 'User journey',
  gitGraph: 'Git graph',
};

/** Best-effort title for imported code: an explicit title, else the diagram type. */
export function deriveTitle(code: string): string {
  const titled =
    /^\s*(?:title|accTitle)\s*:?\s*(.+)$/m.exec(code) ?? /^\s*pie\s+title\s+(.+)$/m.exec(code);
  if (titled?.[1])
    return titled[1]
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 120);
  const fm = /^---\s*\n[\s\S]*?^title:\s*(.+)$/m.exec(code);
  if (fm?.[1]) return fm[1].trim().slice(0, 120);
  const first = code
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%') && l !== '---');
  const kw = first?.split(/\s+/)[0] ?? '';
  return TYPE_NAMES[kw] ? `Imported ${TYPE_NAMES[kw].toLowerCase()}` : 'Imported diagram';
}
