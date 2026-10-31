import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiagramVersion } from '@tidepool/shared';
import { colorForId } from '@tidepool/shared';
import clsx from 'clsx';
import { diffLines } from 'diff';
import {
  Bookmark,
  Clock,
  History,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Button, Dialog, IconButton, Input, Menu, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/time';

interface Props {
  diagramId: string;
  currentCode: string;
  currentConfig: string;
  previewing: DiagramVersion | null;
  onPreview: (v: DiagramVersion | null) => void;
  onClose: () => void;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function DiffView({ from, to }: { from: string; to: string }) {
  const parts = useMemo(() => diffLines(from, to), [from, to]);
  const added = parts.filter((p) => p.added).reduce((n, p) => n + (p.count ?? 0), 0);
  const removed = parts.filter((p) => p.removed).reduce((n, p) => n + (p.count ?? 0), 0);
  if (!added && !removed)
    return <p className="text-xs text-muted">Identical to the current diagram.</p>;
  return (
    <div>
      <p className="mb-1 text-xs text-muted">
        Restoring changes <span className="text-green-600 dark:text-green-400">+{added}</span> /{' '}
        <span className="text-danger">−{removed}</span> lines
      </p>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] leading-4">
        {parts.map((p, i) => {
          const lines = p.value.replace(/\n$/, '').split('\n');
          if (!p.added && !p.removed) {
            // Collapse long unchanged runs.
            if (lines.length > 6) {
              return (
                <span key={i} className="block text-muted">
                  {lines.slice(0, 2).map((l) => `  ${l}\n`)}
                  {`  ⋯ ${lines.length - 4} unchanged lines\n`}
                  {lines.slice(-2).map((l) => `  ${l}\n`)}
                </span>
              );
            }
            return (
              <span key={i} className="block text-muted">
                {lines.map((l) => `  ${l}\n`)}
              </span>
            );
          }
          return (
            <span
              key={i}
              className={clsx(
                'block',
                p.added
                  ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                  : 'bg-danger/12 text-danger',
              )}
            >
              {lines.map((l) => `${p.added ? '+' : '−'} ${l}\n`)}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export function HistoryPanel({
  diagramId,
  currentCode,
  currentConfig,
  previewing,
  onPreview,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const key = ['versions', diagramId];
  const versions = useQuery({
    queryKey: key,
    queryFn: () => api.listVersions(diagramId),
    refetchInterval: 30_000,
  });
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<DiagramVersion | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<DiagramVersion | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: (n: string) => api.saveVersion(diagramId, n),
    onSuccess: () => {
      toast.success('Version saved');
      setSaveOpen(false);
      setName('');
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rename = useMutation({
    mutationFn: ({ v, n }: { v: DiagramVersion; n: string }) =>
      api.renameVersion(diagramId, v.id, n),
    onSuccess: () => {
      setRenaming(null);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (v: DiagramVersion) => api.deleteVersion(diagramId, v.id),
    onSuccess: (_, v) => {
      if (previewing?.id === v.id) onPreview(null);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const restore = useMutation({
    mutationFn: (v: DiagramVersion) => api.restoreVersion(diagramId, v.id),
    onSuccess: () => {
      toast.success('Version restored for everyone');
      onPreview(null);
      setConfirmRestore(null);
      void invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: DiagramVersion[] }> = [];
    for (const v of versions.data ?? []) {
      const day = dayLabel(v.createdAt);
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(v);
      else out.push({ day, items: [v] });
    }
    return out;
  }, [versions.data]);

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="history-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <History size={15} className="text-muted" />
        <h2 className="flex-1 text-sm font-semibold">Version history</h2>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setName('');
            setSaveOpen(true);
          }}
        >
          <Save size={13} /> Save version
        </Button>
        <IconButton label="Close history" onClick={onClose} className="size-7">
          <X size={15} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {versions.isPending ? (
          <div className="grid place-items-center py-12 text-muted">
            <Spinner />
          </div>
        ) : !versions.data?.length ? (
          <p className="px-2 py-8 text-center text-xs text-muted">
            No versions yet. Snapshots are saved automatically every few minutes while people edit,
            or save one now.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="mb-3">
              <h3 className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {g.day}
              </h3>
              {g.items.map((v) => {
                const active = previewing?.id === v.id;
                const people = v.contributors.length
                  ? v.contributors
                  : v.createdBy
                    ? [v.createdBy]
                    : [];
                return (
                  <div
                    key={v.id}
                    className={clsx(
                      'group rounded-lg border',
                      active
                        ? 'border-accent bg-accent/5'
                        : 'border-transparent hover:bg-surface-2',
                    )}
                  >
                    <div className="flex items-start gap-2 px-2 py-1.5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => onPreview(active ? null : v)}
                        data-testid="version-item"
                      >
                        <div className="flex items-center gap-1.5 text-sm">
                          {v.kind === 'named' ? (
                            <Bookmark size={13} className="shrink-0 text-accent" />
                          ) : v.kind === 'restore' ? (
                            <RotateCcw size={13} className="shrink-0 text-muted" />
                          ) : (
                            <Clock size={13} className="shrink-0 text-muted" />
                          )}
                          <span className={clsx('truncate', v.kind === 'named' && 'font-medium')}>
                            {v.name ?? formatDateTime(v.createdAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <span title={new Date(v.createdAt).toLocaleString()}>
                            {v.name ? formatDateTime(v.createdAt) : timeAgo(v.createdAt)}
                          </span>
                          {people.length > 0 && (
                            <span className="flex items-center gap-1">
                              ·
                              <span className="flex -space-x-1">
                                {people.slice(0, 4).map((u) => (
                                  <Avatar
                                    key={u.id}
                                    name={u.name}
                                    image={u.image}
                                    color={colorForId(u.id)}
                                    size={16}
                                  />
                                ))}
                              </span>
                              <span className="truncate">
                                {people.length === 1
                                  ? people[0]!.name.split(' ')[0]
                                  : `${people.length} people`}
                              </span>
                            </span>
                          )}
                        </div>
                      </button>
                      <Menu
                        trigger={(p) => (
                          <IconButton
                            label="Version actions"
                            className="size-6 opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
                            {...p}
                          >
                            <MoreHorizontal size={14} />
                          </IconButton>
                        )}
                        items={[
                          {
                            label: 'Restore this version',
                            icon: <RotateCcw size={14} />,
                            onSelect: () => setConfirmRestore(v),
                          },
                          {
                            label: v.name ? 'Rename' : 'Name this version',
                            icon: <Pencil size={14} />,
                            onSelect: () => {
                              setName(v.name ?? '');
                              setRenaming(v);
                            },
                          },
                          {
                            label: 'Delete',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onSelect: () => remove.mutate(v),
                          },
                        ]}
                      />
                    </div>
                    {active && (
                      <div className="space-y-2 px-2 pb-2">
                        <DiffView from={currentCode} to={v.code} />
                        {v.config !== currentConfig && (
                          <p className="text-xs text-muted">The config also differs.</p>
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full"
                          onClick={() => setConfirmRestore(v)}
                        >
                          <RotateCcw size={13} /> Restore this version
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save version"
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate(name.trim())}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate(name.trim());
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Reviewed with platform team"
            className="w-full"
            aria-label="Version name"
          />
          <p className="mt-2 text-xs text-muted">
            Named versions are kept forever. Automatic snapshots are thinned out over time.
          </p>
        </form>
      </Dialog>
      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Name version"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => renaming && rename.mutate({ v: renaming, n: name.trim() })}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming && name.trim()) rename.mutate({ v: renaming, n: name.trim() });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            aria-label="Version name"
          />
        </form>
      </Dialog>
      <Dialog
        open={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        title="Restore this version?"
        footer={
          <>
            <Button onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={restore.isPending}
              onClick={() => confirmRestore && restore.mutate(confirmRestore)}
            >
              {restore.isPending ? <Spinner /> : <RotateCcw size={13} />} Restore
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The diagram will change to{' '}
          <strong className="text-fg">
            {confirmRestore?.name ?? (confirmRestore && formatDateTime(confirmRestore.createdAt))}
          </strong>{' '}
          for everyone editing it. The current state is saved as a version first, so you can undo
          this.
        </p>
      </Dialog>
    </div>
  );
}
