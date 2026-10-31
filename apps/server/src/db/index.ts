import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../env.ts';
import type { Database } from './schema.ts';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  // Railway's public proxy needs TLS; the private network does not.
  ssl: /sslmode=require/.test(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
});

export const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
