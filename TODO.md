# TODO

Follow-ups left after the overhaul (November 2026), most important first.
Each item says why it matters and roughly where the work goes.

## Reliability and security

- [ ] **Keep offline edits across a reload.** Edits made while disconnected live only in that tab's memory.
  The browser now warns before you close the tab with unsaved changes, but the edits are lost if the tab or
  browser crashes. Add [`y-indexeddb`](https://github.com/yjs/y-indexeddb) next to the Hocuspocus provider in
  `apps/web/src/collab/useCollab.ts`, so unsynced edits survive a reload and sync once back online.
- [ ] **Add a Content-Security-Policy header.** It's off today (`apps/server/src/app.ts`, `secureHeaders`) because
  Monaco and mermaid inject inline styles. Start in report-only mode and allow:
  - `blob:` workers (Monaco)
  - `data:` images (exports and thumbnails)
  - Google avatars (`*.googleusercontent.com`)
  - Google Fonts, if any are used

  Then turn it on. Config strings with `url()` or `@import` are already stripped, so this is defence in depth.
- [ ] **Cap the size of a single board.** Websocket messages are limited to 4 MB, but repeated edits can still grow
  a board without bound, and every automatic snapshot copies it. Reject Yjs updates that push a document past a
  set size, in Hocuspocus `beforeHandleMessage` or `onChange` (`apps/server/src/collab.ts`).
- [ ] **Send less data in the library list.** It returns each board's full code so cards can draw thumbnails, and
  it refreshes every 15 seconds. With many large boards, send a trimmed preview instead, or cache rendered
  thumbnails on the server.
- [ ] **Add indexes on `diagram_id`** to `diagram_visit` and `diagram_star`, so deleting a board doesn't scan
  those tables. Harmless at 10–50 users; needed if usage grows.
- [ ] **Support more than one server instance.** Today the app must run as a single Railway replica because open
  documents live in that server's memory. To add replicas, use `@hocuspocus/extension-redis` (Railway has a Redis
  template).

## Accessibility and UI foundations

- [ ] **Replace the hand-rolled Menu and Dialog with a library** such as Radix UI or Headless UI
  (`apps/web/src/components/ui.tsx`). They now trap focus, handle arrow keys and restore focus, but a mature
  library also covers typeahead, nested menus, screen-reader edge cases and the mobile drawer's focus trap.
- [ ] **Full keyboard tree navigation** in the folder sidebar (ArrowLeft/ArrowRight to collapse/expand, ArrowUp/Down
  to move), following the WAI-ARIA tree pattern (`apps/web/src/library/Sidebar.tsx`).

## Library

- [ ] Drag folders to reorganise them, and show how many boards each folder holds in the sidebar.
- [ ] An **Empty trash** button, plus a note on how long trashed boards are kept, and optional automatic deletion.
- [ ] **Quick open** with Ctrl/Cmd+K: fuzzy-search board titles, and show "matched in code" for search hits.

## Editor

- [ ] **Code → diagram highlight**, the reverse of click-to-code: when the cursor is on a line, highlight the
  matching shape in the preview. It can reuse the ID mapping in `apps/web/src/render/locate.ts`.
- [ ] Make click-to-code work for more diagram types: Git graph commits, Gantt sections, quadrant points, and
  sequence messages that repeat the same text.

## Features (v2)

- [ ] **Comments:** threaded comments on a board, with resolve, @mentions and email notifications.
- [ ] **Public read-only links:** an optional "anyone with the link can view" toggle per board, for embedding in
  docs or wikis.
- [ ] **AI assist:** generate or fix a diagram from a prompt using the Claude API (needs an API key in the server
  environment).
- [ ] **Presentation mode:** step through several boards full screen.
- [ ] **Visual editor:** drag and drop for flowcharts, kept in sync with the code.
