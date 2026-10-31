export interface PublicUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface DiagramSummary {
  id: string;
  title: string;
  folderId: string | null;
  code: string;
  config: string;
  owner: PublicUser | null;
  updatedBy: PublicUser | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  starred: boolean;
}

export type VersionKind = 'auto' | 'named' | 'restore';

export interface DiagramVersion {
  id: string;
  diagramId: string;
  kind: VersionKind;
  name: string | null;
  code: string;
  config: string;
  createdBy: PublicUser | null;
  createdAt: string;
}

/** Awareness state broadcast by every client. */
export interface PresenceState {
  user: { id: string; name: string; email: string; image: string | null; color: string };
  /** Pointer position in SVG user space, or null when outside the preview. */
  pointer: { x: number; y: number } | null;
  /** Which editor tab the user is focused in. */
  tab: 'code' | 'config';
  /** Current pan/zoom of their preview, used for follow mode. */
  view: { pan: { x: number; y: number }; zoom: number } | null;
}
