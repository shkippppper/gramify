import { Database as DatabaseExtension } from '@hocuspocus/extension-database';
import { Hocuspocus, type onAuthenticatePayload, type onChangePayload } from '@hocuspocus/server';
import { diagramIdFromDocName, docNameFor, YDOC, type PublicUser } from '@tidepool/shared';
import { sql } from 'kysely';
import * as Y from 'yjs';
import type { SessionUser } from './auth.ts';
import { db } from './db/index.ts';

export interface CollabContext {
  user: SessionUser | null;
  /** Server-side edits (restore, rename) carry this flag instead of a user. */
  system?: boolean;
}

const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Per-document bookkeeping for attribution and auto-snapshots. */
interface DocTracking {
  contributors: Set<string>;
  lastEditor: string | null;
  lastSnapshotAt: number;
}
const tracking = new Map<string, DocTracking>();

async function track(diagramId: string): Promise<DocTracking> {
  let t = tracking.get(diagramId);
  if (!t) {
    const last = await db
      .selectFrom('diagram_version')
      .select('created_at')
      .where('diagram_id', '=', diagramId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    t = tracking.get(diagramId) ?? {
      contributors: new Set(),
      lastEditor: null,
      lastSnapshotAt: last ? last.created_at.getTime() : 0,
    };
    tracking.set(diagramId, t);
  }
  return t;
}

export function readDoc(doc: Y.Doc) {
  const title = doc.getMap(YDOC.meta).get('title');
  return {
    code: doc.getText(YDOC.code).toString(),
    config: doc.getText(YDOC.config).toString(),
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null,
  };
}

export function buildDoc(code: string, config: string, title: string) {
  const doc = new Y.Doc();
  doc.transact(() => {
    doc.getText(YDOC.code).insert(0, code);
    doc.getText(YDOC.config).insert(0, config);
    doc.getMap(YDOC.meta).set('title', title);
  });
  return doc;
}

/** Insert a version row; returns its id. */
export async function insertVersion(
  diagramId: string,
  kind: 'auto' | 'named' | 'restore',
  content: { code: string; config: string },
  opts: { name?: string | null; createdBy?: string | null; contributors?: string[] } = {},
) {
  const row = await db
    .insertInto('diagram_version')
    .values({
      diagram_id: diagramId,
      kind,
      name: opts.name ?? null,
      code_text: content.code,
      config_text: content.config,
      created_by: opts.createdBy ?? null,
      contributors: opts.contributors ?? [],
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/**
 * Take (and reset) the set of people who edited since the last snapshot.
 * Used when a version is created manually so attribution isn't lost.
 */
export async function takeContributors(diagramId: string): Promise<string[]> {
  const t = await track(diagramId);
  const ids = [...t.contributors];
  t.contributors.clear();
  t.lastSnapshotAt = Date.now();
  return ids;
}

/** Snapshot the doc as an automatic version if it changed since the latest version. */
async function maybeAutoSnapshot(diagramId: string, content: { code: string; config: string }, force: boolean) {
  const t = await track(diagramId);
  if (t.contributors.size === 0) return;
  if (!force && Date.now() - t.lastSnapshotAt < AUTO_SNAPSHOT_INTERVAL_MS) return;
  const latest = await db
    .selectFrom('diagram_version')
    .select(['code_text', 'config_text'])
    .where('diagram_id', '=', diagramId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (latest && latest.code_text === content.code && latest.config_text === content.config) {
    t.contributors.clear();
    return;
  }
  await insertVersion(diagramId, 'auto', content, {
    createdBy: t.lastEditor,
    contributors: [...t.contributors],
  });
  t.contributors.clear();
  t.lastSnapshotAt = Date.now();
}

export const hocuspocus = new Hocuspocus<CollabContext>({
  name: 'tidepool',
  // Persist at most every 2s while typing, and at least every 10s.
  debounce: 2000,
  maxDebounce: 10000,
  quiet: true,

  async onAuthenticate({ documentName, context, connectionConfig }: onAuthenticatePayload<CollabContext>) {
    if (!context.user && !context.system) throw new Error('Not authenticated');
    const id = diagramIdFromDocName(documentName);
    if (!id || !UUID_RE.test(id)) throw new Error('Unknown document');
    const row = await db
      .selectFrom('diagram')
      .select(['id'])
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!row) throw new Error('Diagram not found');
    connectionConfig.readOnly = false;
  },

  async onChange({ documentName, context }: onChangePayload<CollabContext>) {
    const id = diagramIdFromDocName(documentName);
    if (!id || !context?.user) return;
    const t = await track(id);
    t.contributors.add(context.user.id);
    t.lastEditor = context.user.id;
  },

  extensions: [
    new DatabaseExtension({
      async fetch({ documentName }) {
        const id = diagramIdFromDocName(documentName);
        if (!id) return null;
        const row = await db
          .selectFrom('diagram')
          .select(['ydoc', 'code_text', 'config_text', 'title'])
          .where('id', '=', id)
          .executeTakeFirst();
        if (!row) return null;
        if (row.ydoc) return new Uint8Array(row.ydoc);
        // First open: seed the Y.Doc from the plain-text columns.
        const doc = buildDoc(row.code_text, row.config_text, row.title);
        const state = Y.encodeStateAsUpdate(doc);
        doc.destroy();
        return state;
      },
      async store({ documentName, state, document }) {
        const id = diagramIdFromDocName(documentName);
        if (!id) return;
        const content = readDoc(document);
        const t = await track(id);
        const prev = await db
          .selectFrom('diagram')
          .select(['code_text', 'config_text', 'title'])
          .where('id', '=', id)
          .executeTakeFirst();
        if (!prev) return;
        const changed = prev.code_text !== content.code || prev.config_text !== content.config || (content.title && prev.title !== content.title);
        await db
          .updateTable('diagram')
          .set({
            ydoc: Buffer.from(state),
            code_text: content.code,
            config_text: content.config,
            ...(content.title ? { title: content.title } : {}),
            ...(changed ? { updated_at: sql<Date>`now()`, updated_by: t.lastEditor ?? sql<string>`updated_by` } : {}),
          })
          .where('id', '=', id)
          .execute();
        await maybeAutoSnapshot(id, content, document.getConnectionsCount() === 0);
      },
    }),
  ],

  async afterUnloadDocument({ documentName }) {
    const id = diagramIdFromDocName(documentName);
    if (id) tracking.delete(id);
  },
});

/** Run a server-side transaction on a diagram's live doc (loads it if needed). */
export async function editDoc(diagramId: string, fn: (doc: Y.Doc) => void, user: SessionUser | null) {
  const conn = await hocuspocus.openDirectConnection(docNameFor(diagramId), { user, system: true });
  try {
    await conn.transact(fn);
  } finally {
    await conn.disconnect();
  }
  if (user) {
    const t = await track(diagramId);
    t.contributors.add(user.id);
    t.lastEditor = user.id;
  }
}

/** Current content of a diagram: the live doc if open, else the database. */
export async function currentContent(diagramId: string) {
  const live = hocuspocus.documents.get(docNameFor(diagramId));
  if (live) {
    const c = readDoc(live);
    return { code: c.code, config: c.config };
  }
  const row = await db
    .selectFrom('diagram')
    .select(['code_text', 'config_text'])
    .where('id', '=', diagramId)
    .executeTakeFirst();
  return row ? { code: row.code_text, config: row.config_text } : null;
}

/** Disconnect everyone from a diagram (e.g. after it was deleted). */
export function closeDiagram(diagramId: string) {
  hocuspocus.closeConnections(docNameFor(diagramId));
}

/** Who is currently connected to which diagram (for library cards). */
export function presence(): Record<string, PublicUser[]> {
  const out: Record<string, PublicUser[]> = {};
  for (const [name, doc] of hocuspocus.documents) {
    const id = diagramIdFromDocName(name);
    if (!id) continue;
    const seen = new Map<string, PublicUser>();
    for (const state of doc.awareness.getStates().values()) {
      const u = (state as { user?: PublicUser }).user;
      if (u?.id && !seen.has(u.id)) seen.set(u.id, { id: u.id, name: u.name, email: u.email, image: u.image ?? null });
    }
    if (seen.size) out[id] = [...seen.values()];
  }
  return out;
}

/**
 * Thin out automatic versions: keep all from the last 24h, one per hour up to 30 days,
 * then one per day. Named and restore versions are never pruned.
 */
export async function pruneVersions() {
  const res = await sql`
    DELETE FROM diagram_version v
    USING (
      SELECT id, row_number() OVER (
        PARTITION BY diagram_id,
          CASE WHEN created_at > now() - interval '30 days'
               THEN date_trunc('hour', created_at)
               ELSE date_trunc('day', created_at) END
        ORDER BY created_at DESC
      ) AS rn
      FROM diagram_version
      WHERE kind = 'auto' AND created_at < now() - interval '24 hours'
    ) ranked
    WHERE v.id = ranked.id AND ranked.rn > 1
  `.execute(db);
  return Number(res.numAffectedRows ?? 0);
}
