import type { DiagramSummary, Folder, PublicUser } from '@gramify/shared';
import { colorForId } from '@gramify/shared';
import clsx from 'clsx';
import {
  Copy,
  FolderInput,
  LogOut,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
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
  share: (d: DiagramSummary) => void;
  leave: (d: DiagramSummary) => void;
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
  if (d.role !== 'owner') {
    // Shared with you: only the owner can rename, move, share or delete.
    return [
      { label: 'People with access…', icon: <Users size={14} />, onSelect: () => a.share(d) },
      { label: 'Duplicate to my boards', icon: <Copy size={14} />, onSelect: () => a.duplicate(d) },
      { label: d.starred ? 'Unstar' : 'Star', icon: <Star size={14} />, onSelect: () => a.star(d) },
      'separator',
      {
        label: 'Leave board',
        icon: <LogOut size={14} />,
        danger: true,
        onSelect: () => a.leave(d),
      },
    ];
  }
  return [
    { label: 'Share…', icon: <Users size={14} />, onSelect: () => a.share(d) },
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
  const shown = users.slice(0, 3);
  return (
    <div
      className="flex shrink-0 items-center -space-x-1"
      title={`Here now: ${users.map((u) => u.name).join(', ')}`}
    >
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} image={u.image} color={colorForId(u.id)} size={22} ring />
      ))}
      {users.length > shown.length && (
        <span className="grid size-[22px] place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{users.length - shown.length}
        </span>
      )}
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
  /** The board's folder, when it should be shown (not when already inside it). */
  folder: Folder | undefined;
  present: PublicUser[];
  actions: CardActions;
  layout: 'grid' | 'list';
}) {
  const href = d.deletedAt ? undefined : `/d/${d.id}`;
  const shared = d.role !== 'owner';
  const first = (name: string | undefined) => name?.split(' ')[0];
  const metaText = d.deletedAt
    ? `Deleted ${timeAgo(d.deletedAt)}`
    : [
        shared ? `${first(d.owner?.name) ?? 'Someone'}’s board` : first(d.updatedBy?.name),
        timeAgo(d.updatedAt),
        !shared && folder ? folder.name : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
  const badge = d.deletedAt ? null : shared ? (
    d.role === 'viewer' ? (
      <span
        className="shrink-0 rounded bg-surface-2 px-1 py-px text-[10px] font-medium text-muted"
        title="You can view this board"
      >
        View only
      </span>
    ) : (
      <Users size={12} className="shrink-0 text-muted" aria-label="Shared with you" />
    )
  ) : d.memberCount > 0 ? (
    <span
      className="flex shrink-0 items-center gap-0.5 text-muted"
      title={`Shared with ${d.memberCount} ${d.memberCount === 1 ? 'person' : 'people'}`}
    >
      <Users size={12} /> {d.memberCount}
    </span>
  ) : null;
  const meta = (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      {badge}
      <span
        className="min-w-0 truncate"
        title={shared && d.owner ? `Owner: ${d.owner.name} (${d.owner.email})` : metaText}
      >
        {metaText}
      </span>
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
      label={`${d.starred ? 'Unstar' : 'Star'} ${d.title}`}
      active={d.starred}
      className="size-7"
      onClick={() => actions.star(d)}
    >
      <Star size={14} className={clsx(d.starred && 'fill-current')} />
    </IconButton>
  );

  const dragProps =
    d.deletedAt || d.role !== 'owner'
      ? {}
      : {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData(DND_TYPE, d.id);
            e.dataTransfer.effectAllowed = 'move';
          },
        };

  const title = href ? (
    <Link
      to={href}
      className="min-w-0 truncate text-sm font-medium hover:text-accent"
      title={d.title}
    >
      {d.title}
    </Link>
  ) : (
    <span className="min-w-0 truncate text-sm font-medium" title={d.title}>
      {d.title}
    </span>
  );

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
          className="h-10 w-16 shrink-0 overflow-hidden rounded border border-border bg-white p-1"
        />
        <div className="flex min-w-0 flex-1">{title}</div>
        <Present users={present} />
        <span className="hidden w-60 min-w-0 sm:flex">{meta}</span>
        {star}
        {menu}
      </div>
    );
  }

  // The frame is a fixed 4:3 box: min-h-0 + overflow-hidden stop tall diagrams from stretching it.
  const frame =
    'relative block aspect-[4/3] min-h-0 overflow-hidden border-b border-border bg-white p-3';
  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md"
      {...dragProps}
      data-testid="diagram-card"
    >
      {href ? (
        <Link to={href} className={frame} tabIndex={-1} aria-hidden>
          <Thumbnail code={d.code} config={d.config} className="absolute inset-3" />
        </Link>
      ) : (
        <div className={clsx(frame, 'opacity-60')}>
          <Thumbnail code={d.code} config={d.config} className="absolute inset-3" />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          {title}
          {meta}
        </div>
        <Present users={present} />
        {star}
        {menu}
      </div>
    </div>
  );
}
