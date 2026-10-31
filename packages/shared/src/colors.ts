/** Presence colours, chosen to be readable on both light and dark backgrounds. */
export const PRESENCE_COLORS = [
  '#e5484d', '#f76b15', '#d6a10b', '#30a46c', '#12a594',
  '#0090ff', '#3e63dd', '#8e4ec6', '#d6409f', '#7c66dc',
] as const;

export function colorForId(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PRESENCE_COLORS[(h >>> 0) % PRESENCE_COLORS.length]!;
}
