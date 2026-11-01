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

/** Length of the longest substring of `snippet` contained in `line`. */
function commonLength(snippet: string, line: string) {
  let len = 0;
  for (let j = 0; j < snippet.length; j++) {
    for (let k = j + len + 1; k <= snippet.length; k++) {
      if (line.includes(snippet.slice(j, k))) len = k - j;
      else break;
    }
  }
  return len;
}

/**
 * Line (1-based) of `code` sharing the longest common substring with `snippet`.
 * Ties go to the line nearest `hint` (the parser's own line number).
 */
export function mostRelevantLine(
  snippet: string,
  code: string,
  hint?: number | null,
): number | null {
  if (!snippet.trim()) return null;
  const lines = code.split('\n');
  const scores = lines.map((line) => commonLength(snippet, line));
  const max = Math.max(0, ...scores);
  if (max === 0) return null;
  let best = -1;
  scores.forEach((sc, i) => {
    if (sc !== max) return;
    if (best < 0 || (hint && Math.abs(i + 1 - hint) < Math.abs(best - hint))) best = i + 1;
  });
  return best;
}

/** The few characters just before the parser's caret (the token it choked on). */
export function caretContext(message: string): string {
  const m = /\n(.+)\n(-*)\^/.exec(message);
  if (!m?.[1] || m[2] === undefined) return '';
  const text = m[1];
  const caret = m[2].length;
  return text
    .slice(Math.max(0, caret - 12), caret + 2)
    .replace(/^\.\.\./, '')
    .trim();
}

export function findErrorLine(message: string, code: string, err?: unknown): number | null {
  const reported = /on line (\d+)/.exec(message);
  const count = code.split('\n').length;
  const hint = reported?.[1] && Number(reported[1]) <= count ? Number(reported[1]) : null;
  // The text right before the caret pins the line far better than the whole snippet.
  const near = caretContext(message);
  if (near.length >= 3) {
    const line = mostRelevantLine(near, code, hint);
    if (line) return line;
  }
  const fuzzy = mostRelevantLine(extractErrorLineText(message), code, hint);
  if (fuzzy) return fuzzy;
  const hash = (err as { hash?: { loc?: { first_line?: number }; line?: number } })?.hash;
  if (hash?.loc?.first_line) return hash.loc.first_line;
  if (typeof hash?.line === 'number') return hash.line + 1;
  const m = /on line (\d+)/.exec(message) ?? /line:? (\d+)/i.exec(message);
  if (m?.[1]) {
    const n = Number(m[1]);
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
