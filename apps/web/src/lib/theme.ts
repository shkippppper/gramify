import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'tp-theme';
const listeners = new Set<() => void>();
const media = typeof window !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

let pref = readPref();
const isDark = () => pref === 'dark' || (pref === 'system' && !!media?.matches);

function apply() {
  document.documentElement.classList.toggle('dark', isDark());
  listeners.forEach((l) => l());
}

media?.addEventListener('change', () => pref === 'system' && apply());

export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  apply();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark);
  const current = useSyncExternalStore(subscribe, () => pref);
  return { dark, pref: current, setPref: setThemePref };
}
