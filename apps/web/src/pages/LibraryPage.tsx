import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BRAND, type DiagramSummary, type Folder } from '@gramify/shared';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder as FolderIcon,
  LayoutGrid,
  Link2,
  List,
  Menu as MenuIcon,
  RotateCcw,
  Search,
  Shapes,
  Upload,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ShareDialog } from '../components/ShareDialog';
import { ThemeToggle, TopBar } from '../components/TopBar';
import { UserMenu } from '../components/UserMenu';
import { Button, Dialog, Input, Menu, Spinner } from '../components/ui';
import { SAMPLE_FAMILIES } from '../editor/samples';
import { DiagramCard, type CardActions } from '../library/DiagramCard';
import { DND_TYPE, Sidebar } from '../library/Sidebar';
import { Thumbnail } from '../library/Thumbnail';
import {
  quotaMessage,
  useDiagrams,
  useFolders,
  useLibraryMutation,
  useStar,
  useUsage,
} from '../library/useLibrary';
import { api, type LibraryView, type SortKey } from '../lib/api';
import { useMe } from '../lib/auth';
import { deriveTitle, importErrorMessage, parseFile, parseImport } from '../lib/import';
import { useLocalState } from '../lib/useLocalState';
import { TourHost } from '../tour/Tour';

const VIEW_TITLES: Record<LibraryView, string> = {
  all: 'All boards',
  mine: 'My boards',
  shared: 'Shared with me',
  recent: 'Recent',
  starred: 'Starred',
  trash: 'Trash',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Folder chain from the root down to `id`. */
function folderChain(folders: Folder[], id: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: Folder[] = [];
  for (let cur = id ? byId.get(id) : undefined, i = 0; cur && i < 20; i++) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}
const folderPath = (folders: Folder[], id: string | null) =>
  folderChain(folders, id)
    .map((f) => f.name)
    .join(' / ');

/** A folder tile in the main area: opens the folder, and accepts dropped boards. */
function FolderTile({
  folder,
  onOpen,
  onDrop,
}: {
  folder: Folder;
  onOpen: () => void;
  onDrop: (diagramId: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DND_TYPE);
        if (id) {
          e.preventDefault();
          onDrop(id);
        }
      }}
      className={clsx(
        'flex min-w-0 items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-left text-sm hover:border-accent/60',
        over ? 'border-accent ring-2 ring-accent/30' : 'border-border',
      )}
      title={folder.name}
    >
      <FolderIcon size={16} className="shrink-0 text-muted" />
      <span className="truncate">{folder.name}</span>
    </button>
  );
}

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const rawView = params.get('view');
  const view: LibraryView = rawView && rawView in VIEW_TITLES ? (rawView as LibraryView) : 'all';
  const rawFolder = params.get('folder');
  const [q, setQ] = useState(params.get('q') ?? '');
  // Search after typing pauses, and keep it in the URL so reload/back/share keep it.
  const deferredQ = useDeferredValue(q);
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(deferredQ.trim()), 250);
    return () => clearTimeout(t);
  }, [deferredQ]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedQ) next.set('q', debouncedQ);
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const [sort, setSort] = useLocalState<SortKey>('tp-sort', 'updated');
  const [layout, setLayout] = useLocalState<'grid' | 'list'>('tp-layout', 'grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const folders = useFolders();
  const folderList = folders.data ?? [];
  const folderById = useMemo(() => new Map(folderList.map((f) => [f.id, f])), [folderList]);
  // Ignore folder ids that are malformed or not ours (e.g. an old link) instead of erroring.
  const folderId =
    view === 'mine' &&
    rawFolder &&
    UUID.test(rawFolder) &&
    (folders.isPending || folderById.has(rawFolder))
      ? rawFolder
      : null;
  const list = useDiagrams({ view, folderId, q: debouncedQ, sort });

  const select = (v: LibraryView, f: string | null) => {
    const next = new URLSearchParams();
    if (v !== 'all') next.set('view', v);
    if (f) next.set('folder', f);
    if (debouncedQ) next.set('q', debouncedQ);
    setParams(next);
    setSidebarOpen(false);
  };

  // Mobile drawer: Escape closes it.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  // ---- dialogs ----
  const [renaming, setRenaming] = useState<DiagramSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moving, setMoving] = useState<DiagramSummary | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [deleting, setDeleting] = useState<DiagramSummary | null>(null);
  const [leaving, setLeaving] = useState<DiagramSummary | null>(null);
  const [sharing, setSharing] = useState<DiagramSummary | null>(null);
  const me = useMe();
  const fileRef = useRef<HTMLInputElement>(null);

  const usage = useUsage();
  const atLimit = !!usage.data?.limit && usage.data.used >= usage.data.limit;
  const qcClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: (b: { title?: string; code?: string; config?: string }) =>
      api.createDiagram({ ...b, folderId: view === 'mine' ? folderId : null }),
    onSuccess: (d) => {
      void qcClient.invalidateQueries({ queryKey: ['usage'] });
      navigate(`/d/${d.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  // Explain the limit up front instead of failing after a round trip.
  const create = {
    ...createMutation,
    mutate: (b: { title?: string; code?: string; config?: string }) => {
      if (atLimit && usage.data?.limit) {
        toast.error(quotaMessage(usage.data.limit), {
          action:
            view === 'trash'
              ? undefined
              : { label: 'Open trash', onClick: () => select('trash', null) },
        });
        return;
      }
      createMutation.mutate(b);
    },
  };
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const emptyTrash = useLibraryMutation(() => api.emptyTrash(), 'Trash emptied');

  const rename = useLibraryMutation((p: { id: string; title: string }) =>
    api.updateDiagram(p.id, { title: p.title }),
  );
  const move = useLibraryMutation(
    (p: { id: string; folderId: string | null }) =>
      api.updateDiagram(p.id, { folderId: p.folderId }),
    'Moved',
  );
  const duplicate = useLibraryMutation((id: string) => api.duplicateDiagram(id));
  const star = useStar();
  const trash = useLibraryMutation((id: string) => api.trashDiagram(id));
  const restore = useLibraryMutation((id: string) => api.restoreDiagram(id), 'Restored');
  const leave = useLibraryMutation(
    (id: string) => api.removeMember(id, me.data!.email),
    'You left the board',
  );
  const deleteForever = useLibraryMutation((id: string) => api.deleteForever(id), 'Deleted');

  const actions: CardActions = {
    rename: (d) => {
      setRenameValue(d.title);
      setRenaming(d);
    },
    move: (d) => {
      setMoveTarget(d.folderId ?? '');
      setMoving(d);
    },
    duplicate: (d) =>
      atLimit && usage.data?.limit
        ? void toast.error(quotaMessage(usage.data.limit))
        : duplicate.mutate(d.id, {
            onSuccess: (copy) =>
              toast.success('Duplicated to My boards', {
                action: {
                  label: 'Open',
                  onClick: () => navigate(`/d/${(copy as DiagramSummary).id}`),
                },
              }),
          }),
    star: (d) => star.mutate(d),
    trash: (d) =>
      trash.mutate(d.id, {
        onSuccess: () =>
          toast.success('Moved to trash', {
            action: { label: 'Undo', onClick: () => restore.mutate(d.id) },
          }),
      }),
    restore: (d) => restore.mutate(d.id),
    deleteForever: (d) => setDeleting(d),
    share: (d) => setSharing(d),
    leave: (d) => setLeaving(d),
  };

  const chain = view === 'mine' ? folderChain(folderList, folderId) : [];
  const heading = VIEW_TITLES[view];
  const pageTitle = chain.length ? chain[chain.length - 1]!.name : heading;
  useEffect(() => {
    document.title = `${pageTitle} · ${BRAND.name}`;
  }, [pageTitle]);

  const subfolders =
    view === 'mine' && !debouncedQ
      ? folderList.filter((f) => (f.parentId ?? null) === folderId)
      : [];
  const diagrams = list.data?.diagrams ?? [];
  const presence = list.data?.presence ?? {};
  const cardFolder = (d: DiagramSummary) =>
    d.folderId && d.folderId !== folderId ? folderById.get(d.folderId) : undefined;

  const doImport = () => {
    try {
      const parsed = parseImport(importText);
      if (!parsed.code.trim()) throw new Error('There’s no diagram code in that.');
      create.mutate({ code: parsed.code, config: parsed.config, title: deriveTitle(parsed.code) });
      setImportOpen(false);
      setImportText('');
      setImportError(null);
    } catch (e) {
      setImportError(importErrorMessage(e));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TourHost tour="library" userId={me.data?.id} ready={!list.isLoading} />
      <TopBar
        left={
          <button
            type="button"
            className="rounded p-1 text-muted hover:text-fg md:hidden"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <MenuIcon size={18} />
          </button>
        }
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => navigate('/play')}>
              Playground
            </Button>
            <ThemeToggle />
            <UserMenu />
          </>
        }
      />
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-12 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
        <aside
          className={`${sidebarOpen ? 'fixed inset-y-12 left-0 z-30 shadow-xl' : 'hidden'} w-64 shrink-0 border-r border-border bg-surface md:static md:block`}
        >
          <Sidebar view={view} folderId={folderId} folders={folderList} onSelect={select} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={`${view}:${folderId ?? ''}`} className="tp-page mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 flex-1 basis-48 text-lg font-semibold">
                {chain.length ? (
                  <nav aria-label="Folder path" className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      className="shrink-0 text-muted hover:text-fg"
                      onClick={() => select('mine', null)}
                    >
                      {heading}
                    </button>
                    {chain.map((f, i) => (
                      <span key={f.id} className="flex min-w-0 items-center gap-1">
                        <ChevronRight size={16} className="shrink-0 text-muted" />
                        {i === chain.length - 1 ? (
                          <span className="truncate" aria-current="page" title={f.name}>
                            {f.name}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="truncate text-muted hover:text-fg"
                            onClick={() => select('mine', f.id)}
                            title={f.name}
                          >
                            {f.name}
                          </button>
                        )}
                      </span>
                    ))}
                  </nav>
                ) : (
                  <span className="block truncate">{heading}</span>
                )}
              </h1>
              <div className="relative min-w-40 flex-1 sm:flex-none" data-tour="search">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
                />
                <Input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search titles and code"
                  className="w-full pl-8 sm:w-56"
                  aria-label="Search diagrams"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                disabled={view === 'recent'}
                title={
                  view === 'recent' ? 'Recent is ordered by when you opened each board' : undefined
                }
                className="h-8 rounded-md border border-border bg-surface px-2 text-sm disabled:opacity-50"
                aria-label="Sort by"
              >
                <option value="updated">Last modified</option>
                <option value="created">Created</option>
                <option value="title">Title</option>
              </select>
              <div className="flex rounded-md border border-border">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={layout === 'grid'}
                  className={`p-1.5 ${layout === 'grid' ? 'text-accent' : 'text-muted'}`}
                  onClick={() => setLayout('grid')}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={layout === 'list'}
                  className={`p-1.5 ${layout === 'list' ? 'text-accent' : 'text-muted'}`}
                  onClick={() => setLayout('list')}
                >
                  <List size={15} />
                </button>
              </div>
              {view !== 'trash' && (
                <div className="flex" data-tour="new-diagram">
                  <Button
                    variant="primary"
                    className="rounded-r-none"
                    disabled={create.isPending}
                    onClick={() => create.mutate({})}
                  >
                    {create.isPending ? <Spinner /> : <FilePlus2 size={15} />} New diagram
                  </Button>
                  <Menu
                    trigger={(p) => (
                      <Button
                        variant="primary"
                        className="rounded-l-none border-l border-white/20 px-2"
                        aria-label="More ways to create"
                        {...p}
                      >
                        <ChevronDown size={14} />
                      </Button>
                    )}
                    items={[
                      {
                        label: 'From a sample…',
                        icon: <Shapes size={14} />,
                        onSelect: () => setSamplesOpen(true),
                      },
                      {
                        label: 'Import mermaid.live link or code…',
                        icon: <Link2 size={14} />,
                        onSelect: () => {
                          setImportError(null);
                          setImportOpen(true);
                        },
                      },
                      {
                        label: 'Upload .mmd / .md file…',
                        icon: <Upload size={14} />,
                        onSelect: () => fileRef.current?.click(),
                      },
                    ]}
                  />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".mmd,.mermaid,.md,.markdown,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const { code, title } = parseFile(file.name, await file.text());
                    create.mutate({ code, title });
                  } catch (err) {
                    toast.error(importErrorMessage(err));
                  }
                }}
              />
            </div>

            {view === 'trash' && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-xs text-muted">
                  Only boards you own appear here, and they still count toward your board limit.
                  Restore them, or delete them forever (this also deletes their history).
                </p>
                {diagrams.length > 0 && (
                  <Button size="sm" variant="danger" onClick={() => setEmptyingTrash(true)}>
                    Empty trash
                  </Button>
                )}
              </div>
            )}

            {subfolders.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {subfolders.map((f) => (
                  <FolderTile
                    key={f.id}
                    folder={f}
                    onOpen={() => select('mine', f.id)}
                    onDrop={(id) => move.mutate({ id, folderId: f.id })}
                  />
                ))}
              </div>
            )}

            {list.isPending ? (
              <div className="grid place-items-center py-24 text-muted">
                <Spinner />
              </div>
            ) : list.isError ? (
              <div className="flex flex-col items-center gap-3 py-24 text-center">
                <p className="text-sm text-danger">
                  Couldn’t load boards: {(list.error as Error).message}
                </p>
                <Button onClick={() => void list.refetch()}>
                  <RotateCcw size={14} /> Retry
                </Button>
              </div>
            ) : diagrams.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <p className="max-w-md text-sm text-muted">
                  {debouncedQ
                    ? `No boards match “${debouncedQ}”.`
                    : view === 'trash'
                      ? 'Trash is empty.'
                      : view === 'starred'
                        ? 'Star boards to find them here quickly.'
                        : view === 'recent'
                          ? 'Boards you open show up here.'
                          : view === 'shared'
                            ? 'Nothing shared with you yet. When a board owner adds your email, the board shows up here.'
                            : chain.length
                              ? 'This folder is empty. Drag boards onto it in the sidebar, or create one here.'
                              : 'No boards yet. Boards you create are private until you share them with your team.'}
                </p>
                {(view === 'all' || view === 'mine') && !debouncedQ && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" onClick={() => create.mutate({})}>
                      <FilePlus2 size={15} /> New diagram
                    </Button>
                    <Button onClick={() => setSamplesOpen(true)}>
                      <Shapes size={15} /> Start from a sample
                    </Button>
                  </div>
                )}
              </div>
            ) : layout === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {diagrams.map((d) => (
                  <DiagramCard
                    key={d.id}
                    d={d}
                    folder={cardFolder(d)}
                    present={presence[d.id] ?? []}
                    actions={actions}
                    layout="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {diagrams.map((d) => (
                  <DiagramCard
                    key={d.id}
                    d={d}
                    folder={cardFolder(d)}
                    present={presence[d.id] ?? []}
                    actions={actions}
                    layout="list"
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {sharing && <ShareDialog open onClose={() => setSharing(null)} diagram={sharing} />}

      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename diagram"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!renameValue.trim()}
              onClick={() => {
                if (renaming) rename.mutate({ id: renaming.id, title: renameValue.trim() });
                setRenaming(null);
              }}
            >
              Rename
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming && renameValue.trim())
              rename.mutate({ id: renaming.id, title: renameValue.trim() });
            setRenaming(null);
          }}
        >
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full"
            aria-label="Title"
          />
        </form>
      </Dialog>

      <Dialog
        open={!!moving}
        onClose={() => setMoving(null)}
        title="Move to folder"
        footer={
          <>
            <Button onClick={() => setMoving(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (moving) move.mutate({ id: moving.id, folderId: moveTarget || null });
                setMoving(null);
              }}
            >
              Move
            </Button>
          </>
        }
      >
        <select
          value={moveTarget}
          onChange={(e) => setMoveTarget(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
          aria-label="Folder"
        >
          <option value="">No folder</option>
          {[...folderList]
            .map((f) => ({ f, path: folderPath(folderList, f.id) }))
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(({ f, path }) => (
              <option key={f.id} value={f.id}>
                {path}
              </option>
            ))}
        </select>
        {folderList.length === 0 && (
          <p className="mt-2 text-xs text-muted">Create folders with the + next to “My folders”.</p>
        )}
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import diagram"
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!importText.trim()} onClick={doImport}>
              Import
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-muted">Paste a mermaid.live link or Mermaid code.</p>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          rows={8}
          className={clsx(
            'w-full rounded-md border bg-surface p-2 font-mono text-xs outline-none focus:border-accent',
            importError ? 'border-danger' : 'border-border',
          )}
          placeholder="https://mermaid.live/edit#pako:…"
          aria-label="Link or code"
          aria-invalid={!!importError}
          aria-describedby={importError ? 'import-error' : undefined}
        />
        {importError && (
          <p id="import-error" role="alert" className="mt-2 text-xs text-danger">
            {importError}
          </p>
        )}
      </Dialog>

      <Dialog
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        title="New diagram from a sample"
        width="max-w-4xl"
      >
        <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
          {SAMPLE_FAMILIES.map((fam) => (
            <button
              key={fam.name}
              type="button"
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border text-left hover:border-accent"
              onClick={() => {
                setSamplesOpen(false);
                create.mutate({ code: fam.examples[0]!.code, title: fam.examples[0]!.title });
              }}
            >
              <span className="relative block aspect-[4/3] min-h-0 overflow-hidden bg-white">
                <Thumbnail code={fam.examples[0]!.code} config="{}" className="absolute inset-2" />
              </span>
              <span className="truncate border-t border-border px-2 py-1.5 text-xs font-medium">
                {fam.name}
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete forever?"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) deleteForever.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              Delete forever
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <strong className="text-fg">{deleting?.title}</strong> and its version history will be
          permanently deleted. This can’t be undone.
        </p>
      </Dialog>

      <Dialog
        open={emptyingTrash}
        onClose={() => setEmptyingTrash(false)}
        title="Empty trash?"
        footer={
          <>
            <Button onClick={() => setEmptyingTrash(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                emptyTrash.mutate(undefined);
                setEmptyingTrash(false);
              }}
            >
              Delete all forever
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Every board in your trash and its version history will be permanently deleted. This can’t
          be undone.
        </p>
      </Dialog>

      <Dialog
        open={!!leaving}
        onClose={() => setLeaving(null)}
        title="Leave this board?"
        footer={
          <>
            <Button onClick={() => setLeaving(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (leaving) leave.mutate(leaving.id);
                setLeaving(null);
              }}
            >
              Leave board
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You’ll lose access to <strong className="text-fg">{leaving?.title}</strong>. Only{' '}
          {leaving?.owner?.name ?? 'the owner'} can add you back.
        </p>
      </Dialog>
    </div>
  );
}
