# Gramify: a collaborative Mermaid editor for the team

> Product name **Gramify**. To rename, change it in one place: `packages/shared/src/brand.ts`.
> This is our own product. It uses the open-source `mermaid` library (MIT). It is not affiliated with Mermaid Chart, and it carries none of their branding.

## 1. Goal

A self-hosted website where the team writes Mermaid diagrams together in real time:

- **Single-player parity** with the Mermaid Live Editor (mermaid.live): code editor, config editor, live preview, every diagram type, samples, pan and zoom, export, hand-drawn mode, dark mode.
- **Multiplayer**, which Mermaid Chart only offers on Premium ($20/user/mo): many people editing one diagram at once. You see live cursors and selections in the code, live pointers on the diagram canvas, and an avatar stack of who is in the document.
- **Diagram library**: a dashboard with folders, search, recent items and starred items.
- **Version history**: automatic timeline plus named versions, preview, compare and restore.
- **Google sign-in** for any Google account, with **private boards**: each board is visible only to its creator and the people the creator adds (editor or viewer).
- **Deployed on Railway (Hobby)**: one app service plus Railway Postgres. Estimated cost is about $5–8 a month for 10–50 users.

Not in v1, but the design leaves room for them: comments, AI assist, a visual drag-and-drop editor, presentation mode, public read-only links.

## 2. Research summary

Full notes are in [`RESEARCH.md`](./RESEARCH.md).

| Area        | Finding                                                                                                                           | Decision                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| mermaid lib | `12.2.0` (Oct 2026). v12 makes ELK the default layout, adds the "neo" look, and has 30+ diagram types including many `-beta` ones | Use `mermaid@12.2.0` plus `@mermaid-js/layout-tidy-tree`                                                                     |
| Samples     | The Live Editor gets its 34 sample families from `@mermaid-js/examples@2.0.0` (MIT)                                               | Use that package directly                                                                                                    |
| Editor      | The Live Editor uses `monaco-editor@0.55.1` with a vendored Monarch tokenizer (`monacoExtra.ts`, MIT)                             | Same Monaco version (pinned, see below), plus a vendored and extended tokenizer with attribution                             |
| y-monaco    | `y-monaco@0.1.6` deep-imports `monaco-editor/esm/...`, which **breaks on monaco ≥ 0.56**                                          | **Pin `monaco-editor@0.55.1`**                                                                                               |
| Realtime    | Hocuspocus 4.8 gives us Yjs, auth hooks, debounced persistence, read-only connections, and a Redis path to scale out              | Hocuspocus server inside our Node app                                                                                        |
| Auth        | Better Auth 1.7 Google provider supports `hd` and checks the `hd` claim in the ID token                                           | Better Auth with cookie sessions in Postgres                                                                                 |
| Server      | Hono 4 on `@hono/node-server` 2 (built-in WebSocket upgrade), Kysely with `pg`                                                    | One Node process serves the SPA, `/api/*` and `/collab` (same origin, so the session cookie goes with the WebSocket upgrade) |
| Railway     | Hobby: $5 including $5 of usage, 5 GB volumes, WebSockets without timeouts, 1-click Postgres. Sleep must stay **off**             | 1 replica, sleep off, Dockerfile deploy                                                                                      |

## 3. Architecture

```
Browser (React SPA)
├─ Monaco ──y-monaco──┐
├─ Preview (mermaid) ─┤  Y.Doc  ──HocuspocusProvider──┐  wss /collab
├─ Presence overlay ──┘  awareness                     │
└─ REST (fetch/TanStack Query) ───────────── https /api │
                                                         ▼
Node 22  (apps/server)
├─ Hono: /api/auth/* (Better Auth), /api/diagrams, /api/folders, /api/versions, static SPA
├─ Hocuspocus: onAuthenticate (session cookie) → onLoadDocument/onStoreDocument (Postgres)
│              → auto version snapshots
└─ Kysely → Postgres (Railway)
```

### Shared Y.Doc shape (one doc per diagram, name = `diagram:<uuid>`)

- `Y.Text "code"`: the Mermaid source.
- `Y.Text "config"`: the mermaid config as JSON text, so it can be edited together in the Config tab.
- `Y.Map "meta"`: `title`. A server hook mirrors it to Postgres for the library.

View settings stay **local per user** and are not shared: pan, zoom, grid, hand-drawn post-processing, which pane is shown. This matches how Figma and Mermaid behave.

### Awareness (presence) state

`{ user: { id, name, email, image, color }, pointer: {x, y} | null /* diagram coords */, selection /* y-monaco */, follow?: clientId }`

- Pointer coordinates are in **SVG user space**, so they land on the same node for every viewer whatever their own pan or zoom.
- Each user's colour comes from a hash of their user id over a palette that reads well in both themes.

### Database (Postgres, Kysely migrations)

- Better Auth tables: `user`, `session`, `account`, `verification`.
- `folder(id, name, parent_id null, created_by, created_at)`. Nested folders.
- `diagram(id, title, folder_id null, owner_id, code_text, config_text, ydoc bytea, created_at, updated_at, updated_by, deleted_at null)`.
- `diagram_star(user_id, diagram_id)` and `diagram_visit(user_id, diagram_id, visited_at)`. Visits power "Recent".
- `diagram_version(id, diagram_id, kind 'auto'|'named'|'restore', name null, code_text, config_text, created_by null, created_at)`.

**Access model:** boards are private to their creator (`owner_id`). Only the owner can add people, via
`diagram_member(diagram_id, email, role editor|viewer)`. Members are keyed by email so they can be added
before their first sign-in. Every REST route and the `/collab` handshake check the role:

- Viewers get read-only Yjs connections.
- Boards you can't access return 404.
- Removing someone or changing their role disconnects them so the change applies at once.

Folders are personal (`folder.created_by`).

## 4. Feature spec

### 4.1 Editor page `/d/:id` (and the scratch page `/play`)

- **Top bar:**
  - Logo
  - Breadcrumb (folder › title), with the title editable inline and live for everyone
  - Avatar stack (click a person to follow them)
  - Connection status
  - Share (copy link, copy Markdown image)
  - History toggle
  - Theme toggle
  - User menu
- **Resizable panes** (sizes persist): Editor | Preview | History (optional).
- **Editor card:**
  - Tabs **Code | Config**
  - A "Docs" link for the detected diagram type
  - Monaco with Mermaid highlighting (light and dark), bracket auto-close, and keyword and snippet completion for each diagram type
  - The Config tab is JSON with schema validation, using the schema bundled locally rather than fetched from the CDN
  - Errors: `mermaid.parse` runs on every change and puts red squiggle markers on the corrected line. After a 1.5 s debounce an error bar appears under the editor, and the preview keeps the last good render at 50% opacity
- **Below the editor:**
  - **Samples** (all 34 families from `@mermaid-js/examples`; the chevron opens every variant). Loading a sample into a shared document asks "Replace current diagram?" first
  - **Actions:** PNG (Auto/Width/Height plus size), SVG, Copy image, Copy Markdown, and Download `.mmd`
- **Preview:**
  - Render queue: skip a render if nothing changed; switch to a 1 s debounce if a render takes more than 150 ms
  - svg-pan-zoom with fit/center, zoom from 0.2 to 12, touch support, and toolbar buttons Reset, Zoom ±, Full screen (`/d/:id/view`)
  - Bottom toolbar: Hand-drawn toggle (svg2roughjs), Grid toggle, mermaid version label
  - **Multiplayer overlay:** remote pointers with name labels, drawn in diagram coordinates
- **Theme:** light, dark or system. When the diagram theme is not set explicitly in the config, the diagram theme follows the site theme.
- **Security:** mermaid `securityLevel: 'strict'`. Config keys on mermaid's `secure` list, and values that contain HTML, are stripped.

### 4.2 Multiplayer

- Code: y-monaco binding, plus remote selections and carets in each user's colour with a name tag above the caret.
- Canvas: live pointer of each person's mouse over the preview, throttled to 30 Hz.
- Presence avatars with a tooltip showing name, email and whether they are editing Code or Config.
- **Follow mode:** clicking an avatar makes your view track theirs (scrolls the editor to their caret and mirrors their pan and zoom). Typing or panning yourself stops following.
- Offline and reconnect: the provider reconnects automatically and Yjs merges edits made while offline. The status badge shows Connected, Reconnecting or Offline.
- Undo and redo apply to your own changes only (Y.UndoManager through y-monaco).

### 4.3 Library `/`

- **Sidebar:** Recent, Starred, All diagrams, and the folder tree (create, rename, delete, drag a diagram onto a folder).
- **Grid or list** of cards: live SVG thumbnail rendered lazily in the browser, title, folder, last editor and time, and avatars of anyone in the document now.
- **Search** over title and code, using `ILIKE` plus a trigram index.
- **Sort** by updated, created or title.
- **Card menu:** New diagram (blank, or from a sample), Duplicate, Rename, Move, Delete (soft delete with a Trash view to restore).
- **Import:** paste a mermaid.live link (`#pako:`), or upload a `.mmd` or `.md` file.

### 4.4 Version history (side panel)

- **Timeline of automatic snapshots.** The server takes one at most every 5 minutes while the document changes, and another when the last person leaves.
- **Named versions:** "Save version…" with a name. Named versions are never pruned. Automatic ones are thinned to hourly after 24 h and daily after 30 days.
- **Click a version** to preview it read-only in the preview pane, with a line diff against the current text.
- **Restore** writes that version's code and config into the shared doc in one transaction, so everyone sees it, and first records a `restore` version of the old state so it can be undone.
- Shows who made each change: the users who edited between snapshots.

### 4.5 Auth

- Google sign-in for any Google account (OAuth consent screen: External, published). An optional `ALLOWED_GOOGLE_DOMAIN` restricts sign-in to Workspace domain(s) using the verified `hd` claim.
- Sessions are httpOnly cookies. The `/collab` WebSocket upgrade checks the same session.
- **Dev login** (email and name only) when `DEV_LOGIN=true`. Used for local development and end-to-end tests, and refused when `NODE_ENV=production`.

## 5. Repository layout

```
apps/web        React 19 + Vite + TS + Tailwind 4 (SPA)
apps/server     Hono + Hocuspocus + Better Auth + Kysely
packages/shared shared types, brand, Y.Doc schema helpers, mermaid-link (pako) codec
e2e/            Playwright tests (two browser contexts = two users)
docs/           PLAN.md, RESEARCH.md, DEPLOY.md
Dockerfile      multi-stage, one image
```

## 6. Delivery phases

Each phase ends with typecheck, unit tests, build and a commit.

| #   | Phase                                                                                                                                                                                                                                      | Done when                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 0   | **Scaffold:** pnpm monorepo, TS, lint, Vitest, CI workflow                                                                                                                                                                                 | `pnpm check` passes on CI                                        |
| 1   | **Single-player editor** (`/play`, state in the URL hash, compatible with mermaid.live `#pako:` links): layout, Monaco and language, config tab, preview, errors, samples, pan/zoom, export, hand-drawn, grid, dark mode, full-screen view | Every sample renders. Exports work. Playwright smoke test passes |
| 2   | **Backend and library:** Postgres schema and migrations, Better Auth (Google and dev), diagrams, folders and stars API, library UI, import                                                                                                 | Signed-in user can create, organise and search diagrams          |
| 3   | **Multiplayer:** Hocuspocus, persistence, y-monaco, presence avatars, code cursors, canvas pointers, follow mode, live title                                                                                                               | Two-browser e2e test: edits and cursors appear on both sides     |
| 4   | **Version history:** auto and named snapshots, pruning, preview with diff, restore                                                                                                                                                         | e2e test: save, edit, restore round trip                         |
| 5   | **Deploy:** Dockerfile, `railway.json`, health check, migrations on boot, `DEPLOY.md` (Google Cloud OAuth setup, Railway steps, env vars)                                                                                                  | Image builds and boots against a fresh Postgres                  |
| 6   | **Polish:** keyboard shortcuts, empty, loading and error states, mobile view (switch between edit and view), accessibility pass                                                                                                            | —                                                                |

## 7. Environment variables

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (public origin), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_GOOGLE_DOMAIN`, `DEV_LOGIN` (dev only), `PORT`.

## 8. Risks and mitigations

- **Railway Hobby is "for personal projects"** and adding workspace members needs Pro. This is fine because only the app's users need access, not Railway itself. Pro is $20/mo if needed.
- **Hocuspocus keeps documents in memory,** so we run a single replica. If we ever need more, add `@hocuspocus/extension-redis`.
- **Large or slow diagrams** (ELK layout): handled by the adaptive debounce and render queue. Rendering in a worker is a possible later step.
- **Monaco pinned to 0.55.1** because of y-monaco. If that becomes a problem, the alternative is a Vite alias for the deep import.
- **Two people loading samples or restoring at the same time:** both use single Y transactions, so the last write wins cleanly, and restore records a version first.

## 9. Status (2026-10-31)

Phases 0–6 are implemented and tested. Checks:

- **Unit and integration tests (20):**
  - shared codec
  - error-line heuristics
  - imports
  - Y.Text diffing
  - REST API: auth, diagrams, folders, stars, trash
  - Two Node Yjs clients syncing through `/collab`, persistence, and version restore
  - Pruning
- **Playwright end-to-end tests (6), run against the production build:**
  - Two users co-editing: presence, carets, pointers, live title, local-only undo, follow mode
  - Version save, preview and restore
  - Library: folders, stars, search, trash
  - All 34 sample families render
  - PNG and SVG export
- **Docker image:** builds and boots against an empty Postgres (migrations on boot, SPA fallback, dev login disabled in production).

Not built yet (candidates for v2): comments, AI assist, a visual editor, presentation mode, public read-only links.
