import { getMigrations } from 'better-auth/db/migration';
import { Migrator } from 'kysely/migration';
import { authOptions } from '../auth.ts';
import { db } from './index.ts';
import { migrations } from './migrations.ts';

export async function migrate() {
  const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(authOptions);
  if (toBeCreated.length || toBeAdded.length) {
    console.log(`[migrate] auth schema: +${toBeCreated.length} tables, +${toBeAdded.length} columns`);
    await runMigrations();
  }
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) console.log(`[migrate] ${r.migrationName}: ${r.status}`);
  if (error) throw error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => db.destroy())
    .catch(async (e) => {
      console.error(e);
      await db.destroy();
      process.exit(1);
    });
}
