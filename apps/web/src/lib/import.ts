import { deserializeState } from '@tidepool/shared';

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
