/**
 * Mermaid error-line helpers.
 * Approach adapted from mermaid-live-editor (MIT): parse errors report a line in
 * the *preprocessed* source, so we fuzzy-match the snippet in the message
 * against the real source to find the line the user actually wrote.
 */

export function extractErrorLineText(message: string): string {
  const parse = /Parse error on line \d+:\n(.+)\n+/.exec(message);
  if (parse?.[1]) return parse[1].replace(/^\.\.\./, '');
  const lex = /Lexical error on line \d+\. Unrecognized text\.\n(.+)\n-+/.exec(message);
  return lex?.[1] ? lex[1].replace(/^\.\.\./, '') : '';
}

/** Line (1-based) of `code` sharing the longest common substring with `snippet`. */
export function mostRelevantLine(snippet: string, code: string): number | null {
  if (!snippet.trim()) return null;
  const lines = code.split('\n');
  let best = -1;
  let bestLen = 0;
  lines.forEach((line, i) => {
    let len = 0;
    for (let j = 0; j < snippet.length; j++) {
      for (let k = j + len + 1; k <= snippet.length; k++) {
        if (line.includes(snippet.slice(j, k))) len = k - j;
        else break;
      }
    }
    if (len > bestLen) {
      bestLen = len;
      best = i + 1;
    }
  });
  return best > 0 ? best : null;
}

export function findErrorLine(message: string, code: string, err?: unknown): number | null {
  const fuzzy = mostRelevantLine(extractErrorLineText(message), code);
  if (fuzzy) return fuzzy;
  const hash = (err as { hash?: { loc?: { first_line?: number }; line?: number } })?.hash;
  if (hash?.loc?.first_line) return hash.loc.first_line;
  if (typeof hash?.line === 'number') return hash.line + 1;
  const m = /on line (\d+)/.exec(message) ?? /line:? (\d+)/i.exec(message);
  if (m?.[1]) {
    const n = Number(m[1]);
    const count = code.split('\n').length;
    return n >= 1 && n <= count ? n : null;
  }
  return null;
}

export function normalizeErrorMessage(message: string, line: number | null) {
  if (!line) return message;
  return message
    .replace(/Parse error on line \d+:/, `Parse error on line ${line}:`)
    .replace(/Lexical error on line \d+/, `Lexical error on line ${line}`);
}
