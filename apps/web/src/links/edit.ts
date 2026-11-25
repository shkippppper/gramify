import * as Y from 'yjs';

/**
 * Write a `%% link` line into the diagram's code: replace line `line` (1-based) when given,
 * otherwise append it. `text: null` removes the line.
 */
export function writeLinkLine(code: Y.Text, text: string | null, line?: number) {
  const src = code.toString();
  const lines = src.split('\n');
  code.doc!.transact(() => {
    if (line && line <= lines.length) {
      const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
      const old = lines[line - 1]!;
      if (text === null) {
        // Remove the whole line with one newline: its own, or the one before a last line.
        if (line < lines.length) code.delete(start, old.length + 1);
        else if (start > 0) code.delete(start - 1, old.length + 1);
        else code.delete(0, old.length);
      } else {
        code.delete(start, old.length);
        code.insert(start, text);
      }
      return;
    }
    if (text === null) return;
    const sep = src.length === 0 || src.endsWith('\n') ? '' : '\n';
    code.insert(src.length, `${sep}${text}\n`);
  });
}
