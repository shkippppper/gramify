import { LogOut } from 'lucide-react';
import { useMe, useSignOut } from '../lib/auth';
import { Avatar, Menu } from './ui';

export function UserMenu() {
  const me = useMe();
  const signOut = useSignOut();
  if (!me.data) return null;
  return (
    <Menu
      trigger={(p) => (
        <button type="button" {...p} className="rounded-full" aria-label="Account menu">
          <Avatar name={me.data!.name} image={me.data!.image} size={28} />
        </button>
      )}
      items={[
        {
          label: (
            <span className="flex flex-col">
              <span className="font-medium">{me.data.name}</span>
              <span className="text-xs text-muted">{me.data.email}</span>
            </span>
          ),
          onSelect: () => {},
          disabled: true,
        },
        'separator',
        { label: 'Sign out', icon: <LogOut size={14} />, onSelect: () => void signOut() },
      ]}
    />
  );
}
