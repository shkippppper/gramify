import { BRAND } from '@gramify/shared';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTheme, type ThemePref } from '../lib/theme';
import { IconButton } from './ui';

export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold text-fg">
      <img src="/favicon.svg" alt="" className="size-6" />
      {withName && <span className="hidden sm:inline">{BRAND.name}</span>}
    </Link>
  );
}

const NEXT: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'system', system: 'light' };

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;
  return (
    <IconButton label={`Theme: ${pref}`} onClick={() => setPref(NEXT[pref])}>
      <Icon size={16} />
    </IconButton>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Logo />
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center gap-1.5">{right}</div>
    </header>
  );
}
