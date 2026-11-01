import { DEFAULT_CODE, DEFAULT_CONFIG, YDOC } from '@gramify/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

export type ConnectionStatus = 'local' | 'connecting' | 'connected' | 'disconnected';

/** Everything the editor workspace needs, regardless of local vs. multiplayer mode. */
export interface DiagramSession {
  doc: Y.Doc;
  code: Y.Text;
  config: Y.Text;
  meta: Y.Map<unknown>;
  awareness: Awareness | null;
  readOnly: boolean;
}

export function sessionFromDoc(
  doc: Y.Doc,
  awareness: Awareness | null = null,
  readOnly = false,
): DiagramSession {
  return {
    doc,
    code: doc.getText(YDOC.code),
    config: doc.getText(YDOC.config),
    meta: doc.getMap(YDOC.meta),
    awareness,
    readOnly,
  };
}

export function createLocalDoc(code = DEFAULT_CODE, config = DEFAULT_CONFIG) {
  const doc = new Y.Doc();
  doc.transact(() => {
    doc.getText(YDOC.code).insert(0, code);
    doc.getText(YDOC.config).insert(0, config);
  });
  return doc;
}

/** Move an index off the middle of a UTF-16 surrogate pair (emoji etc.). */
function safeIndex(text: string, i: number) {
  if (i > 0 && i < text.length) {
    const hi = text.charCodeAt(i - 1);
    const lo = text.charCodeAt(i);
    if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) return i - 1;
  }
  return i;
}

/** Replace the whole text of a Y.Text in one transaction (minimal diff at the ends). */
export function replaceText(ytext: Y.Text, next: string, origin?: unknown) {
  const prev = ytext.toString();
  if (prev === next) return;
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  start = Math.min(safeIndex(prev, start), safeIndex(next, start));
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  while (
    (safeIndex(prev, endPrev) !== endPrev || safeIndex(next, endNext) !== endNext) &&
    endPrev < prev.length &&
    endNext < next.length
  ) {
    endPrev++;
    endNext++;
  }
  const doc = ytext.doc;
  const apply = () => {
    if (endPrev > start) ytext.delete(start, endPrev - start);
    if (endNext > start) ytext.insert(start, next.slice(start, endNext));
  };
  if (doc) doc.transact(apply, origin);
  else apply();
}

/** Subscribe React to a Y.Text's string value. */
export function useYText(ytext: Y.Text): string {
  return useSyncExternalStore(
    (cb) => {
      ytext.observe(cb);
      return () => ytext.unobserve(cb);
    },
    () => ytext.toString(),
  );
}

/** Subscribe React to one key of a Y.Map. */
export function useYMapValue<T>(map: Y.Map<unknown>, key: string): T | undefined {
  return useSyncExternalStore(
    (cb) => {
      map.observe(cb);
      return () => map.unobserve(cb);
    },
    () => map.get(key) as T | undefined,
  );
}

/** Re-render on any awareness change; returns states of all clients (incl. self). */
export function useAwarenessStates<T>(awareness: Awareness | null): Map<number, T> {
  const [, force] = useState(0);
  useEffect(() => {
    if (!awareness) return;
    const h = () => force((n) => n + 1);
    awareness.on('change', h);
    return () => awareness.off('change', h);
  }, [awareness]);
  return (awareness?.getStates() ?? new Map()) as Map<number, T>;
}
