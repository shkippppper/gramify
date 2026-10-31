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

/** Your access to a board: the creator owns it; others are added by the owner. */
export type DiagramRole = 'owner' | 'editor' | 'viewer';
export type MemberRole = Exclude<DiagramRole, 'owner'>;

export interface DiagramMember {
  email: string;
  role: MemberRole;
  /** Null until this person has signed in for the first time. */
  user: PublicUser | null;
  addedAt: string;
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
  /** The current user's access to this board. */
  role: DiagramRole;
  /** Number of people added to the board (excluding the owner). */
  memberCount: number;
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
  /** Users who edited between the previous version and this one. */
  contributors: PublicUser[];
  createdAt: string;
}

/** Awareness state broadcast by every client. */
export interface PresenceState {
  user: { id: string; name: string; email: string; image: string | null; color: string };
  /** Pointer position in normalized diagram coordinates (0..1), or null when outside the preview. */
  pointer: { x: number; y: number } | null;
  /** Which editor tab the user is focused in. */
  tab: 'code' | 'config';
  /** What part of the diagram they're looking at (normalized center + scale), for follow mode. */
  view: { cx: number; cy: number; scale: number } | null;
}
