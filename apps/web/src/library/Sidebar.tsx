import type { Folder } from '@tidepool/shared';
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
import { useLibraryMutation } from './useLibrary';

export const DND_TYPE = 'application/x-tidepool-diagram';

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
}: {
  active: boolean;
  icon: ReactNode;
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
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 text-left"
      >
        {icon}
        <span className="truncate">{children}</span>
      </button>
      {trailing}
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
          onClick={() => onSelect('mine', f.id)}
          onDropDiagram={(id) => move.mutate({ id, folderId: f.id })}
          icon={
            <span className="flex items-center">
              <span
                role="button"
                tabIndex={-1}
                aria-label={open ? 'Collapse' : 'Expand'}
                className={clsx(
                  'grid size-4 place-items-center text-muted',
                  !kids.length && 'invisible',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((x) => ({ ...x, [f.id]: !open }));
                }}
              >
                <ChevronRight
                  size={12}
                  className={clsx('transition-transform', open && 'rotate-90')}
                />
              </span>
              <FolderIcon size={15} className="text-muted" />
            </span>
          }
          trailing={
            <Menu
              trigger={(p) => (
                <IconButton
                  label={`Folder actions for ${f.name}`}
                  className="size-6 opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
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
