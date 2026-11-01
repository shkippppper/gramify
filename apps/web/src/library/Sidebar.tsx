import type { Folder } from '@gramify/shared';
import clsx from 'clsx';
import {
  ChevronRight,
  Clock,
  Folder as FolderIcon,
  FolderPlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { api, type LibraryView } from '../lib/api';
import { useLocalState } from '../lib/useLocalState';
import { Button, Dialog, IconButton, Input, Menu } from '../components/ui';
import { useLibraryMutation, useUsage } from './useLibrary';

export const DND_TYPE = 'application/x-gramify-diagram';

interface Props {
  view: LibraryView;
  folderId: string | null;
  folders: Folder[];
  onSelect: (view: LibraryView, folderId: string | null) => void;
}

function NavItem({
  active,
  icon,
  children,
  onClick,
  onDropDiagram,
  depth = 0,
  trailing,
  leading,
  title,
}: {
  active: boolean;
  icon: ReactNode;
  /** Control placed before the main button (e.g. an expand toggle); a sibling, not nested. */
  leading?: ReactNode;
  title?: string;
  children: ReactNode;
  onClick: () => void;
  onDropDiagram?: (diagramId: string) => void;
  depth?: number;
  trailing?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={clsx(
        'group flex items-center rounded-md pr-1 text-sm',
        active ? 'bg-accent/12 text-accent' : 'text-fg hover:bg-surface-2',
        over && 'ring-2 ring-accent',
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
      onDragOver={(e) => {
        if (!onDropDiagram || !e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = e.dataTransfer.getData(DND_TYPE);
        if (id && onDropDiagram) {
          e.preventDefault();
          onDropDiagram(id);
        }
      }}
    >
      {leading}
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        title={title}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 text-left"
      >
        {icon}
        <span className="truncate">{children}</span>
      </button>
      {trailing}
    </div>
  );
}

function UsageMeter() {
  const usage = useUsage();
  const u = usage.data;
  if (!u?.limit) return null;
  const full = u.used >= u.limit;
  return (
    <div
      className="mx-2 mb-2 rounded-lg border border-border px-3 py-2"
      title="Each person can own a limited number of boards, to keep the shared server small. Boards in the trash count too."
      data-testid="usage"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Your boards</span>
        <span className={clsx('font-medium', full ? 'text-danger' : 'text-fg')}>
          {u.used} of {u.limit}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={u.limit}
        aria-valuenow={u.used}
        aria-label="Boards used"
      >
        <div
          className={clsx('h-full rounded-full', full ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${Math.min(100, (u.used / u.limit) * 100)}%` }}
        />
      </div>
      {full && (
        <p className="mt-1.5 text-[11px] leading-4 text-muted">
          Limit reached. Empty the trash or delete a board to make room.
        </p>
      )}
    </div>
  );
}

export function Sidebar({ view, folderId, folders, onSelect }: Props) {
  const [expanded, setExpanded] = useLocalState<Record<string, boolean>>('tp-folders-expanded', {});
  const [dialog, setDialog] = useState<{
    mode: 'create' | 'rename';
    parentId: string | null;
    folder?: Folder;
  } | null>(null);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Folder | null>(null);

  const children = useMemo(() => {
    const m = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const k = f.parentId && folders.some((p) => p.id === f.parentId) ? f.parentId : null;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [folders]);

  const move = useLibraryMutation(
    ({ id, folderId: to }: { id: string; folderId: string | null }) =>
      api.updateDiagram(id, { folderId: to }),
    'Moved',
  );
  const save = useLibraryMutation(async () => {
    if (!dialog || !name.trim()) return;
    if (dialog.mode === 'create') await api.createFolder(name.trim(), dialog.parentId);
    else if (dialog.folder) await api.updateFolder(dialog.folder.id, { name: name.trim() });
  });
  const remove = useLibraryMutation((id: string) => api.deleteFolder(id), 'Folder deleted');

  const renderFolder = (f: Folder, depth: number): ReactNode => {
    const kids = children.get(f.id) ?? [];
    const open = expanded[f.id] ?? false;
    return (
      <div key={f.id}>
        <NavItem
          depth={depth}
          active={view === 'mine' && folderId === f.id}
          onClick={() => {
            onSelect('mine', f.id);
            if (kids.length) setExpanded((x) => ({ ...x, [f.id]: true }));
          }}
          onDropDiagram={(id) => move.mutate({ id, folderId: f.id })}
          title={f.name}
          leading={
            <button
              type="button"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${f.name}`}
              aria-expanded={open}
              tabIndex={kids.length ? 0 : -1}
              className={clsx(
                'grid size-5 shrink-0 place-items-center rounded text-muted hover:text-fg',
                !kids.length && 'invisible',
              )}
              onClick={() => setExpanded((x) => ({ ...x, [f.id]: !open }))}
            >
              <ChevronRight
                size={12}
                className={clsx('transition-transform', open && 'rotate-90')}
              />
            </button>
          }
          icon={<FolderIcon size={15} className="shrink-0 text-muted" />}
          trailing={
            <Menu
              trigger={(p) => (
                <IconButton
                  label={`Folder actions for ${f.name}`}
                  className="size-6 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  {...p}
                >
                  <MoreHorizontal size={14} />
                </IconButton>
              )}
              items={[
                {
                  label: 'New subfolder',
                  icon: <FolderPlus size={14} />,
                  onSelect: () => {
                    setName('');
                    setDialog({ mode: 'create', parentId: f.id });
                    setExpanded((x) => ({ ...x, [f.id]: true }));
                  },
                },
                {
                  label: 'Rename',
                  icon: <Pencil size={14} />,
                  onSelect: () => {
                    setName(f.name);
                    setDialog({ mode: 'rename', parentId: f.parentId, folder: f });
                  },
                },
                {
                  label: 'Delete',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: () => setConfirmDelete(f),
                },
              ]}
            />
          }
        >
          {f.name}
        </NavItem>
        {open && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    );
  };

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-2" aria-label="Library">
      <NavItem
        active={view === 'recent'}
        onClick={() => onSelect('recent', null)}
        icon={<Clock size={15} className="text-muted" />}
      >
        Recent
      </NavItem>
      <NavItem
        active={view === 'starred'}
        onClick={() => onSelect('starred', null)}
        icon={<Star size={15} className="text-muted" />}
      >
        Starred
      </NavItem>
      <NavItem
        active={view === 'all'}
        onClick={() => onSelect('all', null)}
        icon={<LayoutGrid size={15} className="text-muted" />}
      >
        All boards
      </NavItem>
      <NavItem
        active={view === 'shared'}
        onClick={() => onSelect('shared', null)}
        icon={<Users size={15} className="text-muted" />}
      >
        Shared with me
      </NavItem>
      <NavItem
        active={view === 'mine' && !folderId}
        onClick={() => onSelect('mine', null)}
        onDropDiagram={(id) => move.mutate({ id, folderId: null })}
        icon={<UserIcon size={15} className="text-muted" />}
      >
        My boards
      </NavItem>
      <div className="mt-4 mb-1 flex items-center justify-between pr-1 pl-2">
        <span
          className="text-xs font-semibold tracking-wide text-muted uppercase"
          title="Only you see your folders"
        >
          My folders
        </span>
        <IconButton
          label="New folder"
          className="size-6"
          onClick={() => {
            setName('');
            setDialog({ mode: 'create', parentId: null });
          }}
        >
          <FolderPlus size={14} />
        </IconButton>
      </div>
      {(children.get(null) ?? []).map((f) => renderFolder(f, 0))}
      {folders.length === 0 && <p className="px-2 text-xs text-muted">No folders yet.</p>}
      <div className="mt-auto pt-4">
        <UsageMeter />
        <NavItem
          active={view === 'trash'}
          onClick={() => onSelect('trash', null)}
          icon={<Trash2 size={15} className="text-muted" />}
        >
          Trash
        </NavItem>
      </div>

      <Dialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.mode === 'rename' ? 'Rename folder' : 'New folder'}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate(undefined, { onSuccess: () => setDialog(null) })}
            >
              {dialog?.mode === 'rename' ? 'Rename' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate(undefined, { onSuccess: () => setDialog(null) });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="w-full"
            aria-label="Folder name"
          />
        </form>
      </Dialog>
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete folder?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  remove.mutate(confirmDelete.id);
                  if (folderId === confirmDelete.id) onSelect('mine', confirmDelete.parentId);
                }
                setConfirmDelete(null);
              }}
            >
              Delete folder
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <strong className="text-fg">{confirmDelete?.name}</strong> will be removed. Diagrams and
          subfolders inside it move up one level; nothing is deleted.
        </p>
      </Dialog>
    </nav>
  );
}
