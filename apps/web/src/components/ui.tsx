import clsx from 'clsx';
import { ChevronDown, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'grid size-8 shrink-0 place-items-center rounded-md transition-[color,background-color,transform] duration-150 active:scale-90 disabled:opacity-40',
        active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[color,background-color,border-color,transform,filter] duration-150 active:scale-[0.97] disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-110',
        variant === 'secondary' && 'border border-border bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
      {...rest}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-8 rounded-md border border-border bg-surface px-2.5 text-sm text-fg outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20',
        className,
      )}
      {...rest}
    />
  );
}

export function Collapsible({
  title,
  open,
  onToggle,
  children,
  actions,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="border-t border-border">
      <div className="flex items-center">
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase hover:text-fg"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <ChevronDown size={14} className={clsx('transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {actions && <div className="pr-2">{actions}</div>}
      </div>
      {open && (
        <div id={id} className="px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: ReactNode }>;
}) {
  return (
    <div role="tablist" className="flex gap-0.5 rounded-md bg-surface-2 p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={clsx(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === it.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const box = ref.current;
    // Initial focus: an explicit target, else the first field, else the primary footer button.
    const first =
      box?.querySelector<HTMLElement>('[data-autofocus]') ??
      box?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select') ??
      box?.querySelector<HTMLElement>('[data-dialog-footer] button:last-child') ??
      box?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    if (first instanceof HTMLInputElement && first.value) first.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box) return;
      // Keep Tab inside the dialog.
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!box.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prev && prev.isConnected) prev.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div
      className="tp-fade fixed inset-0 z-50 grid grid-cols-[minmax(0,1fr)] place-items-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'w-full min-w-0 rounded-xl border border-border bg-surface shadow-xl',
          width,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold" title={title}>
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div
            data-dialog-footer
            className="flex justify-end gap-2 border-t border-border px-4 py-3"
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Small accessible dropdown menu. It renders in a portal with fixed positioning so no
 * scrolling/clipping container can cut it off, and opens upward when there's no room below.
 * Focus moves in on open, arrow keys move, Escape returns focus to the trigger.
 */
export function Menu({
  trigger,
  items,
  align = 'right',
}: {
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
  }) => ReactNode;
  items: Array<MenuItem | 'separator' | { header: ReactNode }>;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerEl = () => ref.current?.querySelector<HTMLElement>('button');
  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') ??
      []),
  ];
  const close = (refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) triggerEl()?.focus();
  };

  // Position next to the trigger; flip above it if it would overflow the viewport. While open,
  // follow the trigger (the page may scroll or the list may reflow under it), and close once the
  // trigger is gone or scrolled out of view.
  useLayoutEffect(() => {
    if (!open) return;
    let last = '';
    const place = () => {
      const el = triggerEl();
      const m = menuRef.current;
      if (!m) return;
      if (!el?.isConnected) return close(false);
      const t = el.getBoundingClientRect();
      if (t.bottom < 0 || t.top > window.innerHeight) return close(false);
      const { width, height } = m.getBoundingClientRect();
      const gap = 4;
      const up = t.bottom + gap + height > window.innerHeight - 8 && t.top - gap - height > 8;
      const top = up ? t.top - gap - height : t.bottom + gap;
      let left = align === 'right' ? t.right - width : t.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const key = `${Math.round(top)}:${Math.round(left)}:${up}`;
      if (key !== last) {
        last = key;
        setPos({ top, left, up });
      }
    };
    place();
    let frame = 0;
    const loop = () => {
      place();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  useEffect(() => {
    if (!open || !pos) return;
    if (!menuRef.current?.contains(document.activeElement)) menuItems()[0]?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({
        onClick: () => (open ? close(false) : setOpen(true)),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={(e) => {
              const list = menuItems();
              const i = list.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === 'Escape') {
                e.stopPropagation();
                close(true);
              } else if (e.key === 'Tab') {
                close(true);
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const n = list.length;
                list[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus();
              } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                (e.key === 'Home' ? list[0] : list[list.length - 1])?.focus();
              }
            }}
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={clsx(
              'tp-pop z-[60] min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg',
              pos?.up ? 'origin-bottom' : 'origin-top',
            )}
          >
            {items.map((it, i) =>
              it === 'separator' ? (
                <div key={i} role="separator" className="my-1 h-px bg-border" />
              ) : 'header' in it ? (
                <MenuHeader key={i}>{it.header}</MenuHeader>
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  tabIndex={-1}
                  disabled={it.disabled}
                  onClick={() => {
                    // Return focus to the trigger first so a dialog opened by the action restores to it.
                    close(true);
                    it.onSelect();
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors disabled:opacity-40',
                    it.danger
                      ? 'text-danger hover:bg-danger/10 focus:bg-danger/10'
                      : 'text-fg hover:bg-surface-2 focus:bg-surface-2',
                  )}
                >
                  {it.icon && <span className="text-muted">{it.icon}</span>}
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Non-interactive header row for menus (e.g. the signed-in account). */
export function MenuHeader({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1.5 text-sm">{children}</div>;
}

export function Avatar({
  name,
  image,
  color,
  size = 28,
  ring,
}: {
  name: string;
  image?: string | null;
  color?: string;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={clsx(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-semibold text-white',
        ring && 'ring-2 ring-surface',
      )}
      style={{
        width: size,
        height: size,
        background: color ?? '#64748b',
        boxShadow: color ? `0 0 0 2px ${color}` : undefined,
      }}
      title={name}
    >
      {image && !broken ? (
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials || '?'
      )}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden
    />
  );
}
