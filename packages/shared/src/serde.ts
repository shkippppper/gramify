import { deflate, inflate } from 'pako';

/**
 * State codec compatible with mermaid.live URLs (`#pako:<urlsafe-base64>`),
 * so links can be imported from and opened in the public editor.
 */
export interface LinkState {
  code: string;
  mermaid: string; // config JSON as string
  autoSync?: boolean;
  updateDiagram?: boolean;
  rough?: boolean;
  panZoom?: boolean;
  grid?: boolean;
  pan?: { x: number; y: number };
  zoom?: number;
  editorMode?: 'code' | 'config';
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(str: string): Uint8Array {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function serializeState(state: LinkState): string {
  const json = new TextEncoder().encode(JSON.stringify(state));
  return `pako:${toBase64Url(deflate(json, { level: 9 }))}`;
}

export function deserializeState(serialized: string): LinkState {
  let s = serialized.replace(/^#/, '');
  // Accept full URLs too (e.g. https://mermaid.live/edit#pako:...)
  const hashIdx = s.indexOf('#');
  if (hashIdx >= 0) s = s.slice(hashIdx + 1);
  let json: string;
  if (s.startsWith('pako:')) {
    json = new TextDecoder().decode(inflate(fromBase64(s.slice(5))));
  } else if (s.startsWith('base64:')) {
    json = new TextDecoder().decode(fromBase64(s.slice(7)));
  } else {
    json = new TextDecoder().decode(fromBase64(s));
  }
  const parsed = JSON.parse(json) as Partial<LinkState>;
  if (typeof parsed.code !== 'string') throw new Error('Invalid diagram link: missing code');
  return {
    ...parsed,
    code: parsed.code,
    mermaid:
      typeof parsed.mermaid === 'string' ? parsed.mermaid : JSON.stringify(parsed.mermaid ?? {}),
  };
}
