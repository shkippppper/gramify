import type { DiagramSummary, Folder, PublicUser } from '@tidepool/shared';
import { colorForId } from '@tidepool/shared';
import clsx from 'clsx';
import { Copy, FolderInput, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar, IconButton, Menu, type MenuItem } from '../components/ui';
import { timeAgo } from '../lib/time';
import { DND_TYPE } from './Sidebar';
import { Thumbnail } from './Thumbnail';

export interface CardActions {
  rename: (d: DiagramSummary) => void;
  move: (d: DiagramSummary) => void;
  duplicate: (d: DiagramSummary) => void;
  star: (d: DiagramSummary) => void;
  trash: (d: DiagramSummary) => void;
  restore: (d: DiagramSummary) => void;
  deleteForever: (d: DiagramSummary) => void;
}

function menuItems(d: DiagramSummary, a: CardActions): Array<MenuItem | 'separator'> {
  if (d.deletedAt) {
    return [
      { label: 'Restore', icon: <RotateCcw size={14} />, onSelect: () => a.restore(d) },
      {
        label: 'Delete forever',
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => a.deleteForever(d),
      },
    ];
  }
  return [
    { label: 'Rename', icon: <Pencil size={14} />, onSelect: () => a.rename(d) },
    { label: 'Move to folder…', icon: <FolderInput size={14} />, onSelect: () => a.move(d) },
    { label: 'Duplicate', icon: <Copy size={14} />, onSelect: () => a.duplicate(d) },
    { label: d.starred ? 'Unstar' : 'Star', icon: <Star size={14} />, onSelect: () => a.star(d) },
    'separator',
    {
      label: 'Move to trash',
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => a.trash(d),
    },
  ];
}

function Present({ users }: { users: PublicUser[] }) {
  if (!users.length) return null;
  return (
    <div
      className="flex -space-x-1.5"
      title={`Editing now: ${users.map((u) => u.name).join(', ')}`}
    >
      {users.slice(0, 4).map((u) => (
        <Avatar key={u.id} name={u.name} image={u.image} color={colorForId(u.id)} size={20} ring />
      ))}
    </div>
  );
}

export function DiagramCard({
  d,
  folder,
  present,
  actions,
  layout,
}: {
  d: DiagramSummary;
  folder: Folder | undefined;
  present: PublicUser[];
  actions: CardActions;
  layout: 'grid' | 'list';
}) {
  const href = d.deletedAt ? undefined : `/d/${d.id}`;
  const meta = (
    <span className="truncate text-xs text-muted">
      {d.updatedBy ? `${d.updatedBy.name.split(' ')[0]} · ` : ''}
      {timeAgo(d.updatedAt)}
      {folder ? ` · ${folder.name}` : ''}
    </span>
  );
  const menu = (
    <Menu
      trigger={(p) => (
        <IconButton label={`Actions for ${d.title}`} className="size-7" {...p}>
          <MoreHorizontal size={15} />
        </IconButton>
      )}
      items={menuItems(d, actions)}
    />
  );
  const star = !d.deletedAt && (
    <IconButton
      label={d.starred ? 'Unstar' : 'Star'}
      active={d.starred}
      className="size-7"
      onClick={() => actions.star(d)}
    >
      <Star size={14} className={clsx(d.starred && 'fill-current')} />
    </IconButton>
  );

  const dragProps = d.deletedAt
    ? {}
    : {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData(DND_TYPE, d.id);
          e.dataTransfer.effectAllowed = 'move';
        },
      };

  if (layout === 'list') {
    return (
      <div
        className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-surface"
        {...dragProps}
        data-testid="diagram-card"
      >
        <Thumbnail
          code={d.code}
          config={d.config}
          className="h-10 w-16 shrink-0 overflow-hidden rounded border border-border bg-surface p-1"
        />
        {href ? (
          <Link to={href} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">
            {d.title}
          </Link>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
        )}
        <Present users={present} />
        <span className="hidden w-56 sm:flex">{meta}</span>
        {star}
        {menu}
      </div>
    );
  }

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md"
      {...dragProps}
      data-testid="diagram-card"
    >
      {href ? (
        <Link
          to={href}
          className="block aspect-[4/3] border-b border-border bg-bg p-3"
          tabIndex={-1}
          aria-hidden
        >
          <Thumbnail code={d.code} config={d.config} className="size-full" />
        </Link>
      ) : (
        <div className="aspect-[4/3] border-b border-border bg-bg p-3 opacity-60">
          <Thumbnail code={d.code} config={d.config} className="size-full" />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          {href ? (
            <Link to={href} className="truncate text-sm font-medium hover:text-accent">
              {d.title}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium">{d.title}</span>
          )}
          {meta}
        </div>
        <Present users={present} />
        {star}
        {menu}
      </div>
    </div>
  );
}
