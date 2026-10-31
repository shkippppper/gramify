import { zValidator } from './validate.ts';
import { DEFAULT_CODE, DEFAULT_CONFIG, YDOC, type DiagramSummary, type PublicUser } from '@tidepool/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import { closeDiagram, editDoc, presence } from '../collab.ts';
import { db } from '../db/index.ts';
import type { DiagramTable } from '../db/schema.ts';
import { assertUuid, requireUser, type AppEnv } from './context.ts';

type Row = Selectable<Omit<DiagramTable, 'ydoc'>> & {
  owner_name: string | null;
  owner_email: string | null;
  owner_image: string | null;
  editor_name: string | null;
  editor_email: string | null;
  editor_image: string | null;
  starred: boolean;
};

const user = (id: string | null, name: string | null, email: string | null, image: string | null): PublicUser | null =>
  id && name && email ? { id, name, email, image } : null;

export function toSummary(r: Row): DiagramSummary {
  return {
    id: r.id,
    title: r.title,
    folderId: r.folder_id,
    code: r.code_text,
    config: r.config_text,
    owner: user(r.owner_id, r.owner_name, r.owner_email, r.owner_image),
    updatedBy: user(r.updated_by, r.editor_name, r.editor_email, r.editor_image),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    starred: r.starred,
  };
}

function baseQuery(userId: string) {
  return db
    .selectFrom('diagram as d')
    .leftJoin('user as o', 'o.id', 'd.owner_id')
    .leftJoin('user as e', 'e.id', 'd.updated_by')
    .select([
      'd.id',
      'd.title',
      'd.folder_id',
      'd.owner_id',
      'd.code_text',
      'd.config_text',
      'd.created_at',
      'd.updated_at',
      'd.updated_by',
      'd.deleted_at',
      'o.name as owner_name',
      'o.email as owner_email',
      'o.image as owner_image',
      'e.name as editor_name',
      'e.email as editor_email',
      'e.image as editor_image',
      sql<boolean>`exists (select 1 from diagram_star s where s.diagram_id = d.id and s.user_id = ${userId})`.as('starred'),
    ]);
}

export async function getSummary(id: string, userId: string) {
  const row = await baseQuery(userId).where('d.id', '=', id).executeTakeFirst();
  return row ? toSummary(row as Row) : null;
}

const listQuery = z.object({
  view: z.enum(['all', 'recent', 'starred', 'trash']).default('all'),
  folderId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['updated', 'created', 'title']).default('updated'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const createBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  code: z.string().max(500_000).optional(),
  config: z.string().max(100_000).optional(),
});

const patchBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export const diagrams = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', zValidator('query', listQuery), async (c) => {
    const { view, folderId, q, sort, limit } = c.req.valid('query');
    const me = c.get('user').id;
    let query = baseQuery(me);
    if (view === 'trash') query = query.where('d.deleted_at', 'is not', null);
    else query = query.where('d.deleted_at', 'is', null);
    if (view === 'starred') {
      query = query.where((eb) =>
        eb.exists(eb.selectFrom('diagram_star as s').select('s.diagram_id').whereRef('s.diagram_id', '=', 'd.id').where('s.user_id', '=', me)),
      );
    }
    if (view === 'recent') {
      query = query
        .innerJoin('diagram_visit as v', (j) => j.onRef('v.diagram_id', '=', 'd.id').on('v.user_id', '=', me))
        .orderBy('v.visited_at', 'desc');
    }
    if (folderId && view === 'all') query = query.where('d.folder_id', '=', folderId);
    if (q?.trim()) {
      const like = `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      query = query.where((eb) => eb.or([eb('d.title', 'ilike', like), eb('d.code_text', 'ilike', like)]));
    }
    if (view !== 'recent') {
      if (sort === 'title') query = query.orderBy('d.title', 'asc');
      else if (sort === 'created') query = query.orderBy('d.created_at', 'desc');
      else query = query.orderBy('d.updated_at', 'desc');
    }
    const rows = await query.limit(limit).execute();
    return c.json({ diagrams: rows.map((r) => toSummary(r as Row)), presence: presence() });
  })
  .post('/', zValidator('json', createBody), async (c) => {
    const body = c.req.valid('json');
    const me = c.get('user').id;
    const row = await db
      .insertInto('diagram')
      .values({
        title: body.title ?? 'Untitled diagram',
        folder_id: body.folderId ?? null,
        owner_id: me,
        updated_by: me,
        code_text: body.code ?? DEFAULT_CODE,
        config_text: body.config ?? DEFAULT_CONFIG,
        deleted_at: null,
        ydoc: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.json(await getSummary(row.id, me), 201);
  })
  .get('/presence', (c) => c.json(presence()))
  .get('/:id', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user').id;
    const summary = await getSummary(id, me);
    if (!summary) throw new HTTPException(404, { message: 'Diagram not found' });
    if (!summary.deletedAt) {
      await db
        .insertInto('diagram_visit')
        .values({ user_id: me, diagram_id: id, visited_at: new Date() })
        .onConflict((oc) => oc.columns(['user_id', 'diagram_id']).doUpdateSet({ visited_at: new Date() }))
        .execute();
    }
    return c.json(summary);
  })
  .patch('/:id', zValidator('json', patchBody), async (c) => {
    const id = assertUuid(c.req.param('id'));
    const body = c.req.valid('json');
    const me = c.get('user');
    const exists = await db.selectFrom('diagram').select('id').where('id', '=', id).where('deleted_at', 'is', null).executeTakeFirst();
    if (!exists) throw new HTTPException(404, { message: 'Diagram not found' });
    if (body.folderId !== undefined) {
      await db.updateTable('diagram').set({ folder_id: body.folderId }).where('id', '=', id).execute();
    }
    if (body.title !== undefined) {
      await db.updateTable('diagram').set({ title: body.title }).where('id', '=', id).execute();
      // Keep the live doc's title in sync so everyone editing sees it immediately.
      await editDoc(id, (doc) => doc.getMap(YDOC.meta).set('title', body.title), me);
    }
    return c.json(await getSummary(id, me.id));
  })
  .post('/:id/duplicate', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user').id;
    const src = await db.selectFrom('diagram').selectAll().where('id', '=', id).executeTakeFirst();
    if (!src) throw new HTTPException(404, { message: 'Diagram not found' });
    const row = await db
      .insertInto('diagram')
      .values({
        title: `${src.title} (copy)`.slice(0, 200),
        folder_id: src.folder_id,
        owner_id: me,
        updated_by: me,
        code_text: src.code_text,
        config_text: src.config_text,
        ydoc: null,
        deleted_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.json(await getSummary(row.id, me), 201);
  })
  .delete('/:id', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const permanent = c.req.query('permanent') === '1';
    if (permanent) {
      const res = await db.deleteFrom('diagram').where('id', '=', id).where('deleted_at', 'is not', null).executeTakeFirst();
      if (!res.numDeletedRows) throw new HTTPException(409, { message: 'Move the diagram to the trash first' });
    } else {
      await db.updateTable('diagram').set({ deleted_at: new Date() }).where('id', '=', id).execute();
      closeDiagram(id);
    }
    return c.body(null, 204);
  })
  .post('/:id/restore', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await db.updateTable('diagram').set({ deleted_at: null }).where('id', '=', id).execute();
    return c.json(await getSummary(id, c.get('user').id));
  })
  .put('/:id/star', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await db
      .insertInto('diagram_star')
      .values({ user_id: c.get('user').id, diagram_id: id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return c.body(null, 204);
  })
  .delete('/:id/star', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await db.deleteFrom('diagram_star').where('user_id', '=', c.get('user').id).where('diagram_id', '=', id).execute();
    return c.body(null, 204);
  });
