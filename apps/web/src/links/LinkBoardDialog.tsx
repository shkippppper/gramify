import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Globe } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Dialog, Input, Spinner, stagger } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/time';
import { Thumbnail } from '../library/Thumbnail';

export type LinkChoice =
  { kind: 'board'; id: string; title: string } | { kind: 'url'; url: string };

/** Pick the board (or web page) a shape should link to. */
export function LinkBoardDialog({
  open,
  shape,
  currentBoardId,
  onClose,
  onPick,
}: {
  open: boolean;
  /** How the shape is named in the code (shown in the title). */
  shape: string;
  currentBoardId?: string;
  onClose: () => void;
  onPick: (choice: LinkChoice) => void;
}) {
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const isUrl = /^https?:\/\/\S+$/i.test(query);
  const boards = useQuery({
    queryKey: ['diagrams', 'link-picker', query],
    queryFn: () => api.listDiagrams({ view: 'all', q: query || undefined }),
    enabled: open && !isUrl,
  });
  const list = (boards.data?.diagrams ?? []).filter((d) => d.id !== currentBoardId).slice(0, 30);
  const close = () => {
    setQ('');
    onClose();
  };
  const pick = (c: LinkChoice) => {
    setQ('');
    onPick(c);
  };
  return (
    <Dialog open={open} onClose={close} title={`Link “${shape}” to a board`} width="max-w-lg">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your boards, or paste a web address"
        aria-label="Search boards"
        className="mb-3 w-full"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (isUrl) pick({ kind: 'url', url: query });
          else if (list[0]) pick({ kind: 'board', id: list[0].id, title: list[0].title });
        }}
      />
      <div className="max-h-[50vh] overflow-y-auto" data-testid="link-picker">
        {isUrl ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-2"
            onClick={() => pick({ kind: 'url', url: query })}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
              <Globe size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">Link to this web page</span>
              <span className="block truncate text-xs text-muted">{query}</span>
            </span>
          </button>
        ) : boards.isPending ? (
          <div className="grid place-items-center py-8 text-muted">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {query ? `No boards match “${query}”.` : 'No other boards yet.'}
          </p>
        ) : (
          <ul className="tp-stagger space-y-1">
            {list.map((d, i) => (
              <li key={d.id} style={stagger(i)}>
                <button
                  type="button"
                  className={clsx(
                    'group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                  )}
                  onClick={() => pick({ kind: 'board', id: d.id, title: d.title })}
                >
                  <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded border border-border bg-white">
                    <Thumbnail
                      code={d.code}
                      config={d.config}
                      className="tp-bob absolute inset-1"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {d.role === 'owner' ? 'Yours' : `${d.owner?.name ?? 'Someone'}’s`} ·{' '}
                      {timeAgo(d.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
