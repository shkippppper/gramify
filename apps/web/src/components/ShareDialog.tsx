import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiagramRole, DiagramSummary, MemberRole } from '@gramify/shared';
import { colorForId } from '@gramify/shared';
import { Check, Eye, Link2, LogOut, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { Avatar, Button, Dialog, IconButton, Input, Spinner } from './ui';

const ROLE_LABEL: Record<DiagramRole, string> = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'Can view',
};

/**
 * Who has access to a board. The owner can add people by email and change or remove them;
 * everyone else sees the list and can leave.
 */
export function ShareDialog({
  open,
  onClose,
  diagram,
}: {
  open: boolean;
  onClose: () => void;
  diagram: Pick<DiagramSummary, 'id' | 'title' | 'owner' | 'role'>;
}) {
  const qc = useQueryClient();
  const me = useMe();
  const navigate = useNavigate();
  const key = ['members', diagram.id];
  const members = useQuery({
    queryKey: key,
    queryFn: () => api.listMembers(diagram.id),
    enabled: open,
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [formError, setFormError] = useState<string | null>(null);
  const isOwner = diagram.role === 'owner';

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['diagrams'] });
  };
  const add = useMutation({
    mutationFn: (p: { email: string; role: MemberRole }) =>
      api.addMember(diagram.id, p.email, p.role),
    onSuccess: (list, p) => {
      qc.setQueryData(key, list);
      refresh();
      setEmail('');
      setFormError(null);
      toast.success(`${p.email} can now ${p.role === 'editor' ? 'edit' : 'view'} this board`);
    },
    onError: (e) => setFormError((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (m: { email: string; role: MemberRole }) => api.removeMember(diagram.id, m.email),
    onSuccess: (_, m) => {
      refresh();
      toast.success(`Removed ${m.email}`, {
        action: { label: 'Undo', onClick: () => add.mutate({ email: m.email, role: m.role }) },
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const leave = useMutation({
    mutationFn: () => api.removeMember(diagram.id, me.data!.email),
    onSuccess: () => {
      toast.success('You left the board');
      refresh();
      navigate('/');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = () => {
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setFormError('Enter a valid email address.');
      return;
    }
    add.mutate({ email: v, role });
  };

  const link = `${location.origin}/d/${diagram.id}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isOwner ? `Share “${diagram.title}”` : 'People with access'}
      width="max-w-lg"
    >
      {isOwner ? (
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            type="email"
            placeholder="Add people by email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFormError(null);
            }}
            className={clsx('min-w-0 flex-1', formError && 'border-danger')}
            aria-label="Email address"
            aria-invalid={!!formError}
            aria-describedby={formError ? 'share-error' : undefined}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
            aria-label="Access"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <Button type="submit" variant="primary" disabled={!email.trim() || add.isPending}>
            {add.isPending ? <Spinner /> : <UserPlus size={14} />} Add
          </Button>
          {formError && (
            <p id="share-error" role="alert" className="w-full text-xs text-danger">
              {formError}
            </p>
          )}
        </form>
      ) : (
        <p className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          Only the owner can add or remove people.
        </p>
      )}

      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        People with access
      </h3>
      <ul className="max-h-72 space-y-1 overflow-y-auto" data-testid="member-list">
        {diagram.owner && (
          <li className="flex items-center gap-3 rounded-md px-1 py-1.5">
            <Avatar
              name={diagram.owner.name}
              image={diagram.owner.image}
              color={colorForId(diagram.owner.id)}
              size={30}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                {diagram.owner.name}{' '}
                {diagram.owner.id === me.data?.id && <span className="text-muted">(you)</span>}
              </div>
              <div className="truncate text-xs text-muted">{diagram.owner.email}</div>
            </div>
            <span className="text-xs text-muted">Owner</span>
          </li>
        )}
        {members.isPending && open ? (
          <li className="grid place-items-center py-4 text-muted">
            <Spinner />
          </li>
        ) : (
          members.data?.map((m) => {
            const isMe = m.email === me.data?.email.toLowerCase();
            return (
              <li
                key={m.email}
                className="flex items-center gap-3 rounded-md px-1 py-1.5"
                data-testid="member"
              >
                <Avatar
                  name={m.user?.name ?? m.email}
                  image={m.user?.image}
                  color={m.user ? colorForId(m.user.id) : undefined}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {m.user?.name ?? m.email} {isMe && <span className="text-muted">(you)</span>}
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    {m.user ? (
                      <span className="truncate">{m.email}</span>
                    ) : (
                      <span
                        className="shrink-0 rounded bg-surface-2 px-1 py-px text-[10px] font-medium"
                        title="They haven’t signed in yet. The board appears for them once they do."
                      >
                        Invite pending
                      </span>
                    )}
                  </div>
                </div>
                {isOwner ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        add.mutate({ email: m.email, role: e.target.value as MemberRole })
                      }
                      className="h-7 rounded-md border border-border bg-surface px-1.5 text-xs"
                      aria-label={`Access for ${m.email}`}
                    >
                      <option value="editor">Can edit</option>
                      <option value="viewer">Can view</option>
                    </select>
                    <IconButton
                      label={`Remove ${m.email}`}
                      className="size-7"
                      onClick={() => remove.mutate({ email: m.email, role: m.role })}
                    >
                      <X size={14} />
                    </IconButton>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {m.role === 'viewer' ? <Eye size={12} /> : <Check size={12} />}{' '}
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            );
          })
        )}
        {members.data?.length === 0 && isOwner && (
          <li className="px-1 py-2 text-xs text-muted">
            Only you can see this board. Add people above to collaborate.
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast.success('Link copied. Only people with access can open it.');
            } catch {
              toast.error(`Couldn’t copy automatically. The link is ${link}`);
            }
          }}
        >
          <Link2 size={14} /> Copy link
        </Button>
        {!isOwner && (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
          >
            <LogOut size={14} /> Leave board
          </Button>
        )}
      </div>
    </Dialog>
  );
}
