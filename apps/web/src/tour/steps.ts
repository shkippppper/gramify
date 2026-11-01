/**
 * The product tour, and the registry of user-facing features.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ RULE: every user-facing feature gets a step here (see CONTRIBUTING.md).     │
 * │ When you add one, give it `since: TOUR_VERSION + 1` and bump TOUR_VERSION.  │
 * │ People who already finished the tour then see a short "What's new" tour     │
 * │ with just the new steps.                                                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * `target` is a `[data-tour="…"]` attribute in the UI. If it isn't on screen
 * (e.g. nobody else is in the board yet), the step is shown centred instead.
 */

export interface TourStep {
  id: string;
  /** Value of the `data-tour` attribute to spotlight; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
  /** Tour version that introduced this step. */
  since: number;
}

export type TourName = 'library' | 'editor';

/** Bump when steps are added; equals the highest `since` below. */
export const TOUR_VERSION = 1;

export const TOURS: Record<TourName, TourStep[]> = {
  library: [
    {
      id: 'welcome',
      title: 'Welcome to Gramify 👋',
      body: 'Write Mermaid diagrams as code and edit them together in real time. This quick tour shows you around. It takes about a minute.',
      since: 1,
    },
    {
      id: 'create',
      target: 'new-diagram',
      title: 'Create a board',
      body: 'Start from scratch. The arrow also lets you start from one of 34 sample diagrams, import a mermaid.live link or Mermaid code, or upload a .mmd / .md file.',
      since: 1,
    },
    {
      id: 'views',
      target: 'nav-views',
      title: 'Find your boards',
      body: 'Recent, Starred, All boards, Shared with me and My boards: everything you can open is here. Boards are private until their owner shares them.',
      since: 1,
    },
    {
      id: 'folders',
      target: 'folders',
      title: 'Personal folders',
      body: 'Group your boards into folders and subfolders. Drag a card onto a folder to move it. Only you see your folders.',
      since: 1,
    },
    {
      id: 'search',
      target: 'search',
      title: 'Search',
      body: 'Searches board titles and the diagram code itself.',
      since: 1,
    },
    {
      id: 'cards',
      target: 'board-card',
      title: 'Board cards',
      body: 'Click to open. ★ stars a board. ⋯ has Share, Rename, Move to folder, Duplicate and Trash. Small avatars show who is editing right now.',
      since: 1,
    },
    {
      id: 'usage',
      target: 'usage',
      title: 'Your board limit',
      body: 'Each person can own a limited number of boards, including the trash, to keep the shared server small. Empty the trash to make room.',
      since: 1,
    },
    {
      id: 'trash',
      target: 'trash',
      title: 'Trash',
      body: 'Boards you delete land here first. Restore them, or delete them forever (one by one or with Empty trash).',
      since: 1,
    },
    {
      id: 'account',
      target: 'account',
      title: 'Your account',
      body: 'Change your display name with the ✎ pencil, replay this tour, or sign out. The Playground lets you sketch without saving.',
      since: 1,
    },
  ],
  editor: [
    {
      id: 'code',
      target: 'editor',
      title: 'Write Mermaid code',
      body: 'Syntax highlighting, autocomplete and live error markers. Everything saves automatically and shows up for everyone instantly.',
      since: 1,
    },
    {
      id: 'config',
      target: 'editor-tabs',
      title: 'Code and Config',
      body: 'Config holds Mermaid settings such as the theme or layout, as JSON with autocomplete.',
      since: 1,
    },
    {
      id: 'preview',
      target: 'preview',
      title: 'Live preview',
      body: 'Drag to pan and scroll to zoom. Double-click any shape to jump to its code. While you type, the shapes on your current line are outlined here.',
      since: 1,
    },
    {
      id: 'view-tools',
      target: 'preview-tools',
      title: 'View tools',
      body: 'Reset the view, zoom, or open a live full-screen view (handy for presenting). Bottom left: hand-drawn style and grid.',
      since: 1,
    },
    {
      id: 'title',
      target: 'title',
      title: 'Board title',
      body: 'Rename the board here. Everyone sees the new title live.',
      since: 1,
    },
    {
      id: 'share',
      target: 'share',
      title: 'Share',
      body: 'The owner adds people by email as editors or viewers, and can change or remove them at any time. Viewers watch live but can’t edit.',
      since: 1,
    },
    {
      id: 'presence',
      target: 'presence',
      title: 'Work together',
      body: 'When teammates join, their avatars appear here and you see their cursors in the code and their pointers on the diagram. Click an avatar to follow their view.',
      since: 1,
    },
    {
      id: 'history',
      target: 'history',
      title: 'Version history',
      body: 'Snapshots are saved automatically while people edit. Save named versions, preview any version with a diff, and restore it for everyone (undoable).',
      since: 1,
    },
    {
      id: 'export',
      target: 'actions',
      title: 'Samples and export',
      body: 'Load a sample diagram, export PNG or SVG, copy the image or Markdown, or open the diagram on mermaid.live.',
      since: 1,
    },
    {
      id: 'status',
      target: 'status',
      title: 'Always saved',
      body: 'This shows when your changes are saved. If you go offline, keep the tab open; edits sync when you reconnect.',
      since: 1,
    },
  ],
};
