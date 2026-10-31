import { useCallback, useState } from 'react';
import { load, save } from './storage';

/** useState persisted to localStorage (per-viewer convenience only). */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial));
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        save(key, v);
        return v;
      });
    },
    [key],
  );
  return [value, set] as const;
}
