import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

/** App migrations (run after Better Auth's own tables exist). Append-only. */
export const migrations: Record<string, Migration> = {
  '0001_core': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('folder')
        .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('name', 'text', (c) => c.notNull())
        .addColumn('parent_id', 'uuid', (c) => c.references('folder.id').onDelete('cascade'))
        .addColumn('created_by', 'text', (c) => c.references('user.id').onDelete('set null'))
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .execute();

      await db.schema
        .createTable('diagram')
        .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('title', 'text', (c) => c.notNull().defaultTo('Untitled diagram'))
        .addColumn('folder_id', 'uuid', (c) => c.references('folder.id').onDelete('set null'))
        .addColumn('owner_id', 'text', (c) => c.references('user.id').onDelete('set null'))
        .addColumn('code_text', 'text', (c) => c.notNull().defaultTo(''))
        .addColumn('config_text', 'text', (c) => c.notNull().defaultTo('{}'))
        .addColumn('ydoc', 'bytea')
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn('updated_by', 'text', (c) => c.references('user.id').onDelete('set null'))
        .addColumn('deleted_at', 'timestamptz')
        .execute();
      await db.schema.createIndex('diagram_folder_idx').on('diagram').column('folder_id').execute();
      await db.schema
        .createIndex('diagram_updated_idx')
        .on('diagram')
        .column('updated_at')
        .execute();

      await db.schema
        .createTable('diagram_star')
        .addColumn('user_id', 'text', (c) => c.notNull().references('user.id').onDelete('cascade'))
        .addColumn('diagram_id', 'uuid', (c) =>
          c.notNull().references('diagram.id').onDelete('cascade'),
        )
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addPrimaryKeyConstraint('diagram_star_pk', ['user_id', 'diagram_id'])
        .execute();

      await db.schema
        .createTable('diagram_visit')
        .addColumn('user_id', 'text', (c) => c.notNull().references('user.id').onDelete('cascade'))
        .addColumn('diagram_id', 'uuid', (c) =>
          c.notNull().references('diagram.id').onDelete('cascade'),
        )
        .addColumn('visited_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addPrimaryKeyConstraint('diagram_visit_pk', ['user_id', 'diagram_id'])
        .execute();

      await db.schema
        .createTable('diagram_version')
        .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('diagram_id', 'uuid', (c) =>
          c.notNull().references('diagram.id').onDelete('cascade'),
        )
        .addColumn('kind', 'text', (c) =>
          c.notNull().check(sql`kind in ('auto','named','restore')`),
        )
        .addColumn('name', 'text')
        .addColumn('code_text', 'text', (c) => c.notNull())
        .addColumn('config_text', 'text', (c) => c.notNull())
        .addColumn('created_by', 'text', (c) => c.references('user.id').onDelete('set null'))
        .addColumn('contributors', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'`))
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .createIndex('diagram_version_diagram_idx')
        .on('diagram_version')
        .columns(['diagram_id', 'created_at'])
        .execute();
    },
  },
  '0002_search': {
    async up(db: Kysely<any>) {
      // Trigram indexes speed up ILIKE search; skip silently if the extension isn't allowed.
      await sql`
        DO $$ BEGIN
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
          CREATE INDEX IF NOT EXISTS diagram_title_trgm ON diagram USING gin (title gin_trgm_ops);
          CREATE INDEX IF NOT EXISTS diagram_code_trgm ON diagram USING gin (code_text gin_trgm_ops);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'pg_trgm unavailable, search will use sequential scans';
        END $$;
      `.execute(db);
    },
  },
};
