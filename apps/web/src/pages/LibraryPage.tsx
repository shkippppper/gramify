import { useMutation } from '@tanstack/react-query';
import type { DiagramSummary, Folder } from '@tidepool/shared';
import {
  ChevronDown,
  FilePlus2,
  LayoutGrid,
  Link2,
  List,
  Menu as MenuIcon,
  Search,
  Shapes,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ThemeToggle, TopBar } from '../components/TopBar';
import { UserMenu } from '../components/UserMenu';
import { Button, Dialog, Input, Menu, Spinner } from '../components/ui';
import { SAMPLE_FAMILIES } from '../editor/samples';
import { DiagramCard, type CardActions } from '../library/DiagramCard';
import { Sidebar } from '../library/Sidebar';
import { Thumbnail } from '../library/Thumbnail';
import { useDiagrams, useFolders, useLibraryMutation } from '../library/useLibrary';
import { api, type LibraryView, type SortKey } from '../lib/api';
import { parseFile, parseImport } from '../lib/import';
import { useLocalState } from '../lib/useLocalState';

const VIEW_TITLES: Record<LibraryView, string> = {
  all: 'All diagrams',
  recent: 'Recent',
  starred: 'Starred',
  trash: 'Trash',
};

function folderPath(folders: Folder[], id: string | null): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  for (
    let cur = id ? byId.get(id) : undefined, i = 0;
    cur && i < 20;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined, i++
  ) {
    parts.unshift(cur.name);
  }
  return parts.join(' / ');
}

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = (params.get('view') as LibraryView | null) ?? 'all';
  const folderId = params.get('folder');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sort, setSort] = useLocalState<SortKey>('tp-sort', 'updated');
  const [layout, setLayout] = useLocalState<'grid' | 'list'>('tp-layout', 'grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const folders = useFolders();
  const list = useDiagrams({ view, folderId, q: q.trim(), sort });
  const folderList = folders.data ?? [];
  const folderById = useMemo(() => new Map(folderList.map((f) => [f.id, f])), [folderList]);

  const select = (v: LibraryView, f: string | null) => {
    const next = new URLSearchParams();
    if (v !== 'all') next.set('view', v);
    if (f) next.set('folder', f);
    setParams(next);
    setSidebarOpen(false);
  };

  // ---- dialogs ----
  const [renaming, setRenaming] = useState<DiagramSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moving, setMoving] = useState<DiagramSummary | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [deleting, setDeleting] = useState<DiagramSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: (b: { title?: string; code?: string; config?: string }) =>
      api.createDiagram({ ...b, folderId: view === 'all' ? folderId : null }),
    onSuccess: (d) => navigate(`/d/${d.id}`),
    onError: (e) => toast.error((e as Error).message),
  });

  const rename = useLibraryMutation((p: { id: string; title: string }) =>
    api.updateDiagram(p.id, { title: p.title }),
  );
  const move = useLibraryMutation(
    (p: { id: string; folderId: string | null }) =>
      api.updateDiagram(p.id, { folderId: p.folderId }),
    'Moved',
  );
  const duplicate = useLibraryMutation((id: string) => api.duplicateDiagram(id), 'Duplicated');
  const star = useLibraryMutation((d: DiagramSummary) => api.star(d.id, !d.starred));
  const trash = useLibraryMutation((id: string) => api.trashDiagram(id), 'Moved to trash');
  const restore = useLibraryMutation((id: string) => api.restoreDiagram(id), 'Restored');
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
    duplicate: (d) => duplicate.mutate(d.id),
    star: (d) => star.mutate(d),
    trash: (d) => trash.mutate(d.id),
    restore: (d) => restore.mutate(d.id),
    deleteForever: (d) => setDeleting(d),
  };

  const heading =
    view === 'all' && folderId ? folderPath(folderList, folderId) || 'Folder' : VIEW_TITLES[view];
  const diagrams = list.data?.diagrams ?? [];
  const presence = list.data?.presence ?? {};

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <button
            type="button"
            className="rounded p-1 text-muted hover:text-fg md:hidden"
            aria-label="Toggle sidebar"
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
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${sidebarOpen ? 'fixed inset-y-12 left-0 z-30 shadow-xl' : 'hidden'} w-64 shrink-0 border-r border-border bg-surface md:static md:block`}
        >
          <Sidebar view={view} folderId={folderId} folders={folderList} onSelect={select} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 className="mr-auto truncate text-lg font-semibold">{heading}</h1>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search titles and code"
                  className="w-56 pl-8"
                  aria-label="Search diagrams"
                />
              </div>
              {view !== 'recent' && (
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
                  aria-label="Sort by"
                >
                  <option value="updated">Last modified</option>
                  <option value="created">Created</option>
                  <option value="title">Title</option>
                </select>
              )}
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
                <div className="flex">
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
                        onSelect: () => setImportOpen(true),
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
                    toast.error((err as Error).message);
                  }
                }}
              />
            </div>

            {list.isPending ? (
              <div className="grid place-items-center py-24 text-muted">
                <Spinner />
              </div>
            ) : list.isError ? (
              <p className="py-24 text-center text-sm text-danger">
                {(list.error as Error).message}
              </p>
            ) : diagrams.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-24 text-center">
                <p className="text-sm text-muted">
                  {q
                    ? 'No diagrams match your search.'
                    : view === 'trash'
                      ? 'Trash is empty.'
                      : view === 'starred'
                        ? 'Star diagrams to find them here.'
                        : view === 'recent'
                          ? 'Diagrams you open show up here.'
                          : 'No diagrams here yet.'}
                </p>
                {view === 'all' && !q && (
                  <Button variant="primary" onClick={() => create.mutate({})}>
                    <FilePlus2 size={15} /> Create your first diagram
                  </Button>
                )}
              </div>
            ) : layout === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {diagrams.map((d) => (
                  <DiagramCard
                    key={d.id}
                    d={d}
                    folder={d.folderId ? folderById.get(d.folderId) : undefined}
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
                    folder={d.folderId ? folderById.get(d.folderId) : undefined}
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
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import diagram"
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  const parsed = parseImport(importText);
                  create.mutate({
                    code: parsed.code,
                    config: parsed.config,
                    title: 'Imported diagram',
                  });
                  setImportOpen(false);
                  setImportText('');
                } catch (e) {
                  toast.error(`Could not import: ${(e as Error).message}`);
                }
              }}
            >
              Import
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-muted">Paste a mermaid.live link or Mermaid code.</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-border bg-surface p-2 font-mono text-xs outline-none focus:border-accent"
          placeholder="https://mermaid.live/edit#pako:…"
          aria-label="Link or code"
        />
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
              className="flex flex-col overflow-hidden rounded-lg border border-border text-left hover:border-accent"
              onClick={() => {
                setSamplesOpen(false);
                create.mutate({ code: fam.examples[0]!.code, title: fam.examples[0]!.title });
              }}
            >
              <Thumbnail
                code={fam.examples[0]!.code}
                config="{}"
                className="aspect-[4/3] bg-bg p-2"
              />
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
          permanently deleted.
        </p>
      </Dialog>
    </div>
  );
}
