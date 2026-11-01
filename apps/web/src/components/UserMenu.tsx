import { useQueryClient } from '@tanstack/react-query';
import { Check, Compass, LogOut, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { startTour } from '../tour/Tour';
import { authClient, useMe, useSignOut } from '../lib/auth';
import { Avatar, IconButton, Menu, Spinner } from './ui';

/** Fired after a rename so open boards reconnect and show the new name on cursors/avatars. */
export const IDENTITY_CHANGED = 'tp:identity-changed';

function EditableName({ name, email }: { name: string; email: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const next = value.replace(/\s+/g, ' ').trim();
    if (!next || next.length > 80) {
      setError('Use 1–80 characters.');
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await authClient.updateUser({ name: next });
    setSaving(false);
    if (res.error) {
      setError(res.error.message ?? 'Couldn’t save your name');
      return;
    }
    qc.setQueryData(['me'], (old: { name: string } | null | undefined) =>
      old ? { ...old, name: next } : old,
    );
    // Names appear on cards, members lists and history: refresh those.
    void qc.invalidateQueries({ queryKey: ['diagrams'] });
    void qc.invalidateQueries({ queryKey: ['diagram'] });
    void qc.invalidateQueries({ queryKey: ['members'] });
    void qc.invalidateQueries({ queryKey: ['versions'] });
    window.dispatchEvent(new Event(IDENTITY_CHANGED));
    setEditing(false);
    toast.success('Name updated');
  };

  if (!editing) {
    return (
      <span className="flex w-60 items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium" title={name}>
            {name}
          </span>
          <span className="truncate text-xs text-muted" title={email}>
            {email}
          </span>
        </span>
        <IconButton
          label="Edit display name"
          className="size-6 shrink-0"
          onClick={() => {
            setValue(name);
            setError(null);
            setEditing(true);
          }}
        >
          <Pencil size={13} />
        </IconButton>
      </span>
    );
  }

  return (
    <form
      className="flex w-60 flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          maxLength={80}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onFocus={(e) => e.target.select()}
          // Keep typing keys (arrows, Escape, Tab…) away from the menu's own keyboard handling.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Display name"
          aria-invalid={!!error}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <IconButton label="Save name" type="submit" className="size-7 shrink-0" disabled={saving}>
          {saving ? <Spinner /> : <Check size={14} />}
        </IconButton>
        <IconButton label="Cancel" className="size-7 shrink-0" onClick={() => setEditing(false)}>
          <X size={14} />
        </IconButton>
      </span>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : (
        <span className="text-xs text-muted">Shown to people you work with.</span>
      )}
    </form>
  );
}

export function UserMenu() {
  const me = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  if (!me.data) return null;
  return (
    <Menu
      trigger={(p) => (
        <button
          type="button"
          {...p}
          className="rounded-full transition-transform active:scale-95"
          aria-label="Account menu"
          data-tour="account"
        >
          <Avatar name={me.data!.name} image={me.data!.image} size={28} />
        </button>
      )}
      items={[
        { header: <EditableName name={me.data.name} email={me.data.email} /> },
        'separator',
        {
          label: 'Take the tour',
          icon: <Compass size={14} />,
          onSelect: () => {
            // Pages without a tour of their own (the playground) send you to the library's.
            if (!startTour()) navigate('/');
          },
        },
        { label: 'Sign out', icon: <LogOut size={14} />, onSelect: () => void signOut() },
      ]}
    />
  );
}
