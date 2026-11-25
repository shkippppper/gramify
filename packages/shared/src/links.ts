/**
 * Links between boards, written as Mermaid comments so the code stays valid everywhere:
 *
 *   %% link Worker -> Payment worker /d/3f1c…-…      (a board, by id; the title is a reminder)
 *   %% link Worker -> Payment worker                  (a board, by title)
 *   %% link Docs -> https://example.com/runbook       (any web page)
 *
 * `Worker` is the shape to link: a participant / node id or its visible label.
 */

export type LinkTarget =
  { kind: 'board'; id: string | null; title: string } | { kind: 'url'; url: string };

export interface DiagramLink {
  /** Shape to link: an id from the code or a visible label. */
  shape: string;
  target: LinkTarget;
  /** 1-based line of the `%% link` comment. */
  line: number;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LINE_RE = /^\s*%%\s*link\s+(.+?)\s*->\s*(.+?)\s*$/i;
// `Title /d/<id>` (written by Gramify) or `Title #<id>`; the title is optional.
const ID_SUFFIX_RE = new RegExp(`^(.*?)\\s*(?:#|/d/)(${UUID})$`, 'i');
const BOARD_URL_RE = new RegExp(`/d/(${UUID})(?:[/?#]|$)`, 'i');

const unquote = (s: string) => s.replace(/^(["'`])(.*)\1$/, '$2').trim();

export function parseLinkTarget(raw: string): LinkTarget | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    const board = BOARD_URL_RE.exec(text);
    return board
      ? { kind: 'board', id: board[1]!.toLowerCase(), title: '' }
      : { kind: 'url', url: text };
  }
  const withId = ID_SUFFIX_RE.exec(text);
  if (withId) return { kind: 'board', id: withId[2]!.toLowerCase(), title: unquote(withId[1]!) };
  return { kind: 'board', id: null, title: unquote(text) };
}

/** All `%% link` lines in a diagram's code. Later lines win for the same shape. */
export function parseLinks(code: string): DiagramLink[] {
  const out: DiagramLink[] = [];
  code.split('\n').forEach((text, i) => {
    const m = LINE_RE.exec(text);
    if (!m) return;
    const shape = unquote(m[1]!);
    const target = parseLinkTarget(m[2]!);
    if (shape && target) out.push({ shape, target, line: i + 1 });
  });
  return out;
}

/** The comment line for a link to a board (used by "Link to board…"). */
export function formatBoardLink(shape: string, board: { id: string; title: string }) {
  const title = board.title.replace(/\s+/g, ' ').trim();
  return `%% link ${shape} -> ${title ? `${title} ` : ''}/d/${board.id}`;
}

/** Ids of the boards a diagram links to (for backlinks). */
export function linkedBoardIds(code: string): string[] {
  return [
    ...new Set(
      parseLinks(code).flatMap((l) =>
        l.target.kind === 'board' && l.target.id ? [l.target.id] : [],
      ),
    ),
  ];
}
