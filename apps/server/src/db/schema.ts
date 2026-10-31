import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/** Better Auth's user table (camelCase columns). */
export interface UserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FolderTable {
  id: Generated<string>;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}

export interface DiagramTable {
  id: Generated<string>;
  title: string;
  folder_id: string | null;
  owner_id: string | null;
  code_text: string;
  config_text: string;
  ydoc: Buffer | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  updated_by: string | null;
  deleted_at: Date | null;
}

export interface DiagramStarTable {
  user_id: string;
  diagram_id: string;
  created_at: Generated<Date>;
}

export interface DiagramVisitTable {
  user_id: string;
  diagram_id: string;
  visited_at: Date;
}

export interface DiagramVersionTable {
  id: Generated<string>;
  diagram_id: string;
  kind: 'auto' | 'named' | 'restore';
  name: string | null;
  code_text: string;
  config_text: string;
  created_by: string | null;
  /** User ids who edited since the previous version. */
  contributors: string[];
  created_at: Generated<Date>;
}

export interface Database {
  user: UserTable;
  folder: FolderTable;
  diagram: DiagramTable;
  diagram_star: DiagramStarTable;
  diagram_visit: DiagramVisitTable;
  diagram_version: DiagramVersionTable;
}
