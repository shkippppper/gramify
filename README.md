# Gramify

A self-hosted, real-time collaborative [Mermaid](https://mermaid.js.org) editor for the team.

- **The full Mermaid Live Editor experience:**
  - Monaco editor with Mermaid highlighting and completions, plus a JSON config editor with schema validation
  - Live preview with pan and zoom, a hand-drawn mode, a dot grid, and dark mode
  - All 34 sample diagram families
  - Export to PNG, SVG, the clipboard, or `.mmd`
  - mermaid.live link import and export
- **Multiplayer:**
  - Edits from several people merge without conflicts (Yjs CRDT)
  - Live cursors and selections with name tags
  - Teammates' pointers shown live on the diagram
  - Avatars of who is here, and a follow mode
  - The diagram title updates live for everyone
  - Undo only undoes your own changes
- **Board limit:** each person can own up to 5 boards by default (trash included), to keep the shared server small. A meter in the sidebar shows usage; change it with `MAX_BOARDS_PER_USER`.
- **Library:** nested folders (drag diagrams onto them), recent, starred, search over titles and code, trash, duplicate, and live "who's editing" avatars on each card.
- **Version history:**
  - Automatic snapshots while people edit, plus named versions
  - Shows who changed what
  - Preview any version with a line diff, and restore it for everyone (undoable)
- **Private boards with sharing:**
  - Anyone can sign in with Google, but every board is private to its creator.
  - The owner adds people by email as editors or viewers and can remove them at any time.
  - Viewers watch live, read-only.
  - Folders are personal; boards others shared with you appear under "Shared with me".

Built on the open-source `mermaid` library (MIT). Not affiliated with Mermaid Chart.

## Quick start (development)

Requires Node 22.12+, pnpm 10 and Postgres 16. Postgres can come from Docker:

```bash
docker compose up -d db
```

```bash
cp .env.example .env
```

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:5173 and sign in with the **Development sign-in** form, which only exists while
`DEV_LOGIN=true` and outside production. Open a second browser profile with another email to see
multiplayer in action. The scratchpad at `/play` works without signing in.

## Scripts

| Command          | What it does                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`       | Vite (5173) and the API/collab server (3001) with reload                                               |
| `pnpm typecheck` | TypeScript across all packages                                                                         |
| `pnpm test`      | Unit tests, plus server integration tests (needs the `gramify_test` database)                          |
| `pnpm e2e`       | Playwright: two-user collaboration, history, library and playground (needs the `gramify_e2e` database) |
| `pnpm build`     | Production build of the web app                                                                        |

## Layout

```
apps/web         React 19 + Vite + Monaco + mermaid + Yjs client
apps/server      Hono + Hocuspocus (Yjs) + Better Auth + Kysely/Postgres
packages/shared  Types, mermaid.live link codec, presence colours, branding
e2e/             Playwright tests
docs/            PLAN.md (spec), RESEARCH.md, DEPLOY.md (Railway + Google OAuth)
```

To rename the product, edit `packages/shared/src/brand.ts`, plus the `<title>` and favicon in `apps/web`.

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md). It is one Docker service plus Postgres on Railway.
