import { parseLinks } from '@gramify/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';

/** A `%% link` line, resolved to something that can be opened. */
export interface ResolvedLink {
  /** Shape key from the line (an id or label in the diagram). */
  shape: string;
  /** 1-based line of the `%% link` comment. */
  line: number;
  kind: 'board' | 'url';
  /** Where a click goes (absolute URL), or null when the board couldn't be found. */
  href: string | null;
  boardId: string | null;
  /** Board title (as written, or the board's current one) or the URL. */
  title: string;
  problem?: 'not-found' | 'ambiguous';
}

const boardHref = (id: string) => new URL(`/d/${id}`, location.origin).href;

/** Parse the `%% link` lines in `code` and resolve board titles against the boards you can open. */
export function useResolvedLinks(code: string): ResolvedLink[] {
  const parsed = useMemo(() => parseLinks(code), [code]);
  const needsTitles = parsed.some((l) => l.target.kind === 'board' && !l.target.id);
  const me = useMe();
  const boards = useQuery({
    queryKey: ['diagrams', 'link-titles'],
    queryFn: () => api.listDiagrams({ view: 'all' }),
    enabled: needsTitles && !!me.data,
    staleTime: 30_000,
  });
  const key = JSON.stringify(parsed) + (boards.dataUpdatedAt ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolve(parsed, boards.data?.diagrams ?? []), [key]);
}

function resolve(
  parsed: ReturnType<typeof parseLinks>,
  boards: { id: string; title: string; updatedAt: string }[],
): ResolvedLink[] {
  return parsed.map((l) => {
    const t = l.target;
    if (t.kind === 'url')
      return {
        shape: l.shape,
        line: l.line,
        kind: 'url',
        href: t.url,
        boardId: null,
        title: t.url,
      };
    if (t.id)
      return {
        shape: l.shape,
        line: l.line,
        kind: 'board',
        href: boardHref(t.id),
        boardId: t.id,
        title: t.title,
      };
    const want = t.title.toLowerCase();
    const matches = boards
      .filter((b) => b.title.trim().toLowerCase() === want)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const best = matches[0];
    return {
      shape: l.shape,
      line: l.line,
      kind: 'board',
      href: best ? boardHref(best.id) : null,
      boardId: best?.id ?? null,
      title: t.title,
      ...(matches.length === 0
        ? { problem: 'not-found' as const }
        : matches.length > 1
          ? { problem: 'ambiguous' as const }
          : {}),
    };
  });
}
