import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { timeAgo } from '../lib/time';
import { Thumbnail } from '../library/Thumbnail';
import type { ResolvedLink } from './useLinks';

const open = (href: string) => window.open(href, '_blank', 'noopener');

/** Hover card for a linked shape: what it opens, and whether you (and your team) can. */
export function LinkCard({ link, sourceId }: { link: ResolvedLink; sourceId?: string }) {
  if (link.kind === 'url') {
    let host = link.title;
    try {
      host = new URL(link.title).host;
    } catch {
      /* keep the raw text */
    }
    return (
      <div className="w-64 p-3">
        <div className="mb-1 text-xs text-muted">Web page</div>
        <div className="truncate text-sm font-medium">{host}</div>
        <div className="mb-3 truncate text-xs text-muted">{link.title}</div>
        <Button size="sm" variant="primary" onClick={() => open(link.href!)}>
          <ExternalLink size={13} /> Open
        </Button>
      </div>
    );
  }
  if (!link.boardId) {
    return (
      <div className="w-64 p-3 text-sm">
        <div className="mb-1 font-medium">“{link.title}”</div>
        <p className="text-xs text-muted">
          {link.problem === 'ambiguous'
            ? 'More than one board has this title.'
            : 'No board you can open has this title.'}{' '}
          Right-click the shape and use “Link to board…” to pick one.
        </p>
      </div>
    );
  }
  return (
    <BoardCard boardId={link.boardId} title={link.title} href={link.href!} sourceId={sourceId} />
  );
}

function BoardCard({
  boardId,
  title,
  href,
  sourceId,
}: {
  boardId: string;
  title: string;
  href: string;
  sourceId?: string;
}) {
  const board = useQuery({
    queryKey: ['diagram', boardId],
    queryFn: () => api.getDiagram(boardId),
    retry: false,
    staleTime: 15_000,
  });
  const isOwner = board.data?.role === 'owner';
  const reach = useQuery({
    queryKey: ['link-reach', boardId, sourceId],
    queryFn: () => api.linkReach(boardId, sourceId!),
    enabled: isOwner && !!sourceId && sourceId !== boardId,
    retry: false,
  });
  const qc = useQueryClient();
  const share = useMutation({
    mutationFn: async (emails: string[]) => {
      for (const email of emails) await api.addMember(boardId, email, 'viewer');
    },
    onSuccess: (_, emails) => {
      toast.success(`Shared with ${emails.length} ${emails.length === 1 ? 'person' : 'people'}`);
      void qc.invalidateQueries({ queryKey: ['link-reach', boardId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (board.isPending)
    return (
      <div className="grid w-64 place-items-center p-6 text-muted">
        <Spinner />
      </div>
    );
  if (board.isError) {
    const noAccess = board.error instanceof ApiError && board.error.status === 404;
    return (
      <div className="w-64 p-3 text-sm" data-testid="link-card">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <Lock size={13} className="text-muted" /> {title || 'Linked board'}
        </div>
        <p className="text-xs text-muted">
          {noAccess
            ? 'You can’t open this board. Ask its owner to share it with you.'
            : (board.error as Error).message}
        </p>
      </div>
    );
  }
  const d = board.data;
  const missing = reach.data?.missing ?? [];
  return (
    <div className="w-72" data-testid="link-card">
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg border-b border-border bg-white">
        <Thumbnail code={d.code} config={d.config} className="absolute inset-2" />
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-medium">{d.title}</div>
        <div className="mb-3 truncate text-xs text-muted">
          {d.owner?.name ?? 'Someone'}’s board · {timeAgo(d.updatedAt)}
        </div>
        {missing.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <div className="mb-1.5 flex items-start gap-1.5">
              <Users size={13} className="mt-px shrink-0 text-amber-600" />
              <span>
                {missing.length === 1
                  ? `${missing[0]!.name ?? missing[0]!.email} can see this board but not the linked one.`
                  : `${missing.length} people can see this board but not the linked one.`}
              </span>
            </div>
            <Button
              size="sm"
              disabled={share.isPending}
              onClick={() => share.mutate(missing.map((m) => m.email))}
            >
              {share.isPending ? <Spinner /> : <Users size={13} />} Share with{' '}
              {missing.length === 1 ? 'them' : `all ${missing.length}`} (can view)
            </Button>
          </div>
        )}
        <Button size="sm" variant="primary" onClick={() => open(href)}>
          <ExternalLink size={13} /> Open in new tab
        </Button>
      </div>
    </div>
  );
}
