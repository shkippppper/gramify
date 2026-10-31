# Research notes (2026-10-31)

## Mermaid Live Editor (mermaid.live), our parity target

Source: github.com/mermaid-js/mermaid-live-editor (MIT). Checked at app version 2.0.67, which uses mermaid 12.2.0.

- **Layout:**
  - Navbar: menu, History, Share.
  - Resizable panes: editor (default 30%) | preview | history (30%, toggled).
  - Mobile (under 640 px) switches between Edit and View.
- **Editor:**
  - Monaco 0.55.1. The Code and Config tabs are two separate models.
  - Mermaid language: a Monarch tokenizer vendored from `Yash-Singh1/monaco-mermaid`, with its own `mermaid` and `mermaid-dark` themes. Completion is effectively empty.
  - Config: JSON validated against `config.schema.json`.
  - Errors:
    - `mermaid.parse` runs on every edit.
    - The error line is found by fuzzy-matching the error text, then set as a Monaco marker.
    - The preview drops to 50% opacity, and an error bar appears after 3 s.
- **Render:**
  - `mermaid.initialize(config)` then `mermaid.render`, with ZenUML and tidy-tree layout registered.
  - Adaptive debounce: renders slower than 150 ms switch to a 1000 ms debounce.
  - A promise queue skips renders when nothing has changed.
- **Pan/zoom:** svg-pan-zoom 3.6.2 plus hammerjs. Fit and center, zoom 0.2–12, no double-click zoom. Reset is reset() then zoom(0.875). Pan and zoom are saved in state.
- **Hand-drawn:** svg2roughjs post-processing (the `rough` flag), separate from mermaid's `look: handDrawn`. A dot grid (30 px) can be turned on.
- **Theme:** if the config doesn't set a theme, the diagram theme follows the site's dark mode (default ↔ dark, neo ↔ neo-dark).
- **Samples:** `@mermaid-js/examples` (34 families, several variants each, one marked default).
- **State:**
  - Shape: `{code, mermaid(config str), rough, panZoom, grid, pan, zoom, editorMode}`.
  - Encoding: JSON → pako.deflate(level 9) → URL-safe base64, prefixed `#pako:`.
  - Also kept in localStorage.
- **History:** Saved (manual), Timeline (auto every 60 s, max 30), and gist Revisions. Entries can be renamed, restored, opened in a new tab, or exported and imported as JSON.
- **Export:**
  - PNG: Auto (2×), Width or Height, from 3 to 10000 px.
  - SVG, Copy image (ClipboardItem).
  - mermaid.ink PNG/SVG links, Copy Markdown, Kroki link, Load from Gist.
  - Embed builder: iframe or web component.
- **What it lacks:** accounts, server storage, collaboration, real autocomplete.

## Mermaid Chart (the paid product)

- **Tiers:**

  | Tier        | Price       | Gates                                             |
  | ----------- | ----------- | ------------------------------------------------- |
  | Free        | $0          | Few diagrams                                      |
  | Plus        | $10/user/mo | View and comment collaboration only               |
  | **Premium** | $20/user/mo | **Real-time co-editing**, roles, external sharing |
  | Enterprise  | Custom      | SSO/SAML                                          |

- **Features:**
  - Teams → projects → diagrams.
  - Sharing: private, link-view or link-edit.
  - Comments with threads and resolve.
  - "Local Timeline" of revisions.
  - Visual editor, whiteboard, AI chat, presentation mode.
  - Plugins: VS Code, JetBrains, Confluence, Jira, Google Docs, Office.
  - Export: PNG, SVG, PDF, MMD.
- **Live cursors and presence:** their public docs don't describe this UX. Our design (code carets, canvas pointers, avatar stack, follow mode) is our own.

## Mermaid library 12.2.0

- **Diagram keywords:**
  - `flowchart`/`graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`
  - `journey`, `gantt`, `pie`, `quadrantChart`, `requirementDiagram`, `gitGraph`
  - `C4*`, `mindmap`, `timeline`, `kanban`, `architecture`, `treemap`, `eventmodeling`
  - `xychart`, `sankey`, `packet`, `block`, `ishikawa`
  - `-beta` only: `radar`, `treeView`, `venn`, `usecase`, `wardley`, `cynefin`, `swimlane`, `agentflow`, `railroad(-ebnf|-abnf|-peg)`
- **Layouts:** dagre, elk (default in v12) and its variants, cose-bilkent. Looks: classic, handDrawn, neo.
- **Themes:** default, base, dark, forest, neutral, neo, neo-dark, redux, redux-dark, redux-color, redux-dark-color.

## Stack facts

- **Realtime:**
  - yjs 13.6.33 (stay on 13; 14 is beta), y-monaco 0.1.6, y-protocols 1.0.7.
  - @hocuspocus/* 4.8.0 (Node 22 or newer).
  - y-monaco breaks on monaco 0.56 or newer because of its deep import and the new exports map, so pin 0.55.1.
- **Remote cursors:** y-monaco adds the classes `yRemoteSelection-{clientID}` and `yRemoteSelectionHead-{clientID}`. We inject per-user CSS from awareness.
- **Hocuspocus 4:**
  - `onAuthenticate` gets `requestHeaders`. Set `connectionConfig.readOnly` for read-only users.
  - `handleConnection(ws, request, context)` lets the WebSocket share the Hono server.
  - The Database extension takes `fetch` and `store` callbacks (Uint8Array ↔ bytea), debounced 2 s, at most 10 s.
- **Auth:** Better Auth 1.7.14. Its Google provider `hd` option sends the hint and also verifies the claim. Mount it with `auth.handler(c.req.raw)` and read sessions with `auth.api.getSession({headers})`.
- **Railway Hobby:**
  - Cost: $5/mo including $5 of usage. RAM is $10/GB-mo.
  - Limits: 5 GB volume. WebSockets have no timeout.
  - Postgres is a template. Serverless sleep must stay off for the collab server.
  - Up to 2 custom domains. Railpack or Dockerfile builds.
  - Expected cost: about $5–8/mo.
