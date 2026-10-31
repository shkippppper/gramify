/** Shared Y.Doc schema. Every diagram is one Y.Doc. */
export const YDOC = {
  code: 'code',
  config: 'config',
  meta: 'meta',
} as const;

export const docNameFor = (diagramId: string) => `diagram:${diagramId}`;
export const diagramIdFromDocName = (name: string) =>
  name.startsWith('diagram:') ? name.slice('diagram:'.length) : null;

export const DEFAULT_CODE = `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
`;
export const DEFAULT_CONFIG = `{
  "theme": "default"
}`;
