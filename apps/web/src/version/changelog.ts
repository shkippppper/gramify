/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ Release notes, newest first. Shown from the version badge (bottom right).    │
 * │ For a user-facing update: add an entry on top, set the same version in      │
 * │ apps/web/package.json, and tag the commit `v<version>` (see CONTRIBUTING).  │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */
export interface Release {
  /** Semantic version: minor for features, patch for fixes. */
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.8.0',
    date: '2026-11-25',
    title: 'Empty, Sequence, C4, BPMN',
    changes: [
      'New diagram and the sample gallery’s Most used row now offer the same four starting points: Empty, Sequence, C4 and BPMN.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-11-25',
    title: 'Tidier picker',
    changes: [
      'The new-board picker shows just the names (hover a card for its description), without the blinking cursor.',
      'Most used samples are now Sequence, C4 and BPMN.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-11-25',
    title: 'An illustration for every diagram type',
    changes: [
      'Every diagram type in the sample gallery has its own illustration, in the same style as Most used, with no small text to squint at.',
      'The four Railroad notations (IR, EBNF, ABNF, PEG) are one Railroad tile; pick the notation on the tile.',
      'The editor’s Sample diagrams panel shows a small icon next to each type.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-11-24',
    title: 'Most used samples',
    changes: [
      'The sample gallery starts with a Most used section: Empty, Mermaid, C4 architecture and BPMN process.',
      'Simpler cards in the new-board picker: just the name and what it’s for.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-11-24',
    title: 'Mindmap and Kanban previews',
    changes: [
      'Mindmap and Kanban boards and samples show their preview again, and mindmaps export to SVG and PNG correctly.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-24',
    title: 'Motion and illustrations',
    changes: [
      'The template picker’s animations now run across the app: board cards and samples lift on hover and their previews float, and lists, dialogs and release notes ease in one item after another.',
      'New illustrations for empty boards, starred, recent, shared, trash, search with no results, missing boards and the sign-in page.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-24',
    title: 'Templates and release notes',
    changes: [
      'New diagram now asks where to start: Empty, Mermaid, C4 architecture or a BPMN-style process, each with a preview.',
      'The version is shown in the bottom-right corner. Click it to see what’s new.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-17',
    title: 'Deeper zoom',
    changes: [
      'Zoom in much further: up to 30× the fitted size, and always at least 8× actual size, so long diagrams stay readable.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-13',
    title: 'Pinned participants',
    changes: [
      'In sequence diagrams, the participant boxes stay pinned to the top as soon as you scroll past them.',
      'Each person can now own up to 10 boards (was 5).',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-01',
    title: 'Code and diagram, side by side',
    changes: [
      'Double-click a shape to jump to its code; the line under your cursor highlights its shapes.',
      'A guided tour for first-time visitors, with “What’s new” steps when features are added.',
      'Change your display name; presence recovers after a connection drops.',
      'Board limit per person with a usage meter, instant starring, and menus that never get cut off.',
      'After a deploy, a reload prompt instead of errors.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-31',
    title: 'First release',
    changes: [
      'Mermaid editor with live preview, every diagram type, samples, export, hand-drawn mode and dark mode.',
      'Real-time collaboration with live cursors, presence and follow mode.',
      'Google sign-in and a board library with folders, stars, search and trash.',
      'Version history: save, preview and restore versions.',
      'Private boards: only the owner adds people, by email.',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0]!.version;

/** Short git commit of this build, when known (set at build time). */
export const BUILD_SHA: string = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : '';
