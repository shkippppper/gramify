import {
  DEFAULT_CODE,
  DEFAULT_CONFIG,
  YDOC,
  type DiagramMember,
  type DiagramRole,
  type DiagramSummary,
  type PublicUser,
} from '@gramify/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sql, type Selectable } from 'kysely';
import { z } from 'zod';
import { requireRole, roleExpr } from '../access.ts';
import type { SessionUser } from '../auth.ts';
import { closeDiagram, disconnectUser, editDoc, presence } from '../collab.ts';
import { db } from '../db/index.ts';
import type { DiagramTable } from '../db/schema.ts';
import { assertUuid, requireUser, type AppEnv } from './context.ts';
import { zValidator } from './validate.ts';

type Row = Selectable<Omit<DiagramTable, 'ydoc'>> & {
  owner_name: string | null;
  owner_email: string | null;
  owner_image: string | null;
  editor_name: string | null;
  editor_email: string | null;
  editor_image: string | null;
  starred: boolean;
  role: DiagramRole | null;
  member_count: number;
};

const user = (
  id: string | null,
  name: string | null,
  email: string | null,
  image: string | null,
): PublicUser | null => (id && name && email ? { id, name, email, image } : null);

export function toSummary(r: Row): DiagramSummary {
  const role = r.role ?? 'viewer';
  return {
    id: r.id,
    title: r.title,
    // Folders are personal: only the owner's own placement is meaningful.
    folderId: role === 'owner' ? r.folder_id : null,
    code: r.code_text,
    config: r.config_text,
    owner: user(r.owner_id, r.owner_name, r.owner_email, r.owner_image),
    updatedBy: user(r.updated_by, r.editor_name, r.editor_email, r.editor_image),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    starred: r.starred,
    role,
    memberCount: Number(r.member_count),
  };
}

/** Boards the user can access (owned or shared with them), with their role. */
function baseQuery(me: SessionUser) {
  const email = me.email.toLowerCase();
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
      sql<boolean>`exists (select 1 from diagram_star s where s.diagram_id = d.id and s.user_id = ${me.id})`.as(
        'starred',
      ),
      roleExpr(me).as('role'),
      sql<number>`(select count(*) from diagram_member m where m.diagram_id = d.id)`.as(
        'member_count',
      ),
    ])
    .where((eb) =>
      eb.or([
        eb('d.owner_id', '=', me.id),
        eb.exists(
          eb
            .selectFrom('diagram_member as m')
            .select('m.diagram_id')
            .whereRef('m.diagram_id', '=', 'd.id')
            .where('m.email', '=', email),
        ),
      ]),
    );
}

export async function getSummary(id: string, me: SessionUser) {
  const row = await baseQuery(me).where('d.id', '=', id).executeTakeFirst();
  return row ? toSummary(row as Row) : null;
}

async function listMembers(diagramId: string): Promise<DiagramMember[]> {
  const rows = await db
    .selectFrom('diagram_member as m')
    .leftJoin('user as u', (j) => j.on(sql`lower(u.email)`, '=', sql.ref('m.email')))
    .select(['m.email', 'm.role', 'm.created_at', 'u.id', 'u.name', 'u.image'])
    .where('m.diagram_id', '=', diagramId)
    .orderBy('m.created_at')
    .execute();
  return rows.map((r) => ({
    email: r.email,
    role: r.role,
    user: r.id && r.name ? { id: r.id, name: r.name, email: r.email, image: r.image } : null,
    addedAt: r.created_at.toISOString(),
  }));
}

const listQuery = z.object({
  view: z.enum(['all', 'mine', 'shared', 'recent', 'starred', 'trash']).default('all'),
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

const memberBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['editor', 'viewer']).default('editor'),
});

/** A folder id the user may file boards into (their own), or 400. */
async function ownFolder(folderId: string | null | undefined, me: SessionUser) {
  if (!folderId) return null;
  const f = await db
    .selectFrom('folder')
    .select('id')
    .where('id', '=', folderId)
    .where('created_by', '=', me.id)
    .executeTakeFirst();
  if (!f) throw new HTTPException(400, { message: 'Folder not found' });
  return f.id;
}

export const diagrams = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', zValidator('query', listQuery), async (c) => {
    const { view, folderId, q, sort, limit } = c.req.valid('query');
    const me = c.get('user');
    let query = baseQuery(me);
    if (view === 'trash') {
      // Only owners can trash boards, so the trash only shows your own.
      query = query.where('d.deleted_at', 'is not', null).where('d.owner_id', '=', me.id);
    } else {
      query = query.where('d.deleted_at', 'is', null);
    }
    if (view === 'mine') query = query.where('d.owner_id', '=', me.id);
    if (view === 'shared')
      query = query.where((eb) => eb('d.owner_id', 'is', null).or('d.owner_id', '!=', me.id));
    if (view === 'starred') {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('diagram_star as s')
            .select('s.diagram_id')
            .whereRef('s.diagram_id', '=', 'd.id')
            .where('s.user_id', '=', me.id),
        ),
      );
    }
    if (view === 'recent') {
      query = query
        .innerJoin('diagram_visit as v', (j) =>
          j.onRef('v.diagram_id', '=', 'd.id').on('v.user_id', '=', me.id),
        )
        .orderBy('v.visited_at', 'desc');
    }
    if (folderId && view === 'mine') query = query.where('d.folder_id', '=', folderId);
    if (q?.trim()) {
      const like = `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      query = query.where((eb) =>
        eb.or([eb('d.title', 'ilike', like), eb('d.code_text', 'ilike', like)]),
      );
    }
    if (view !== 'recent') {
      if (sort === 'title') query = query.orderBy('d.title', 'asc');
      else if (sort === 'created') query = query.orderBy('d.created_at', 'desc');
      else query = query.orderBy('d.updated_at', 'desc');
    }
    const rows = await query.limit(limit).execute();
    const list = rows.map((r) => toSummary(r as Row));
    const visible = new Set(list.map((d) => d.id));
    const all = presence();
    return c.json({
      diagrams: list,
      presence: Object.fromEntries(Object.entries(all).filter(([id]) => visible.has(id))),
    });
  })
  .post('/', zValidator('json', createBody), async (c) => {
    const body = c.req.valid('json');
    const me = c.get('user');
    const row = await db
      .insertInto('diagram')
      .values({
        title: body.title ?? 'Untitled diagram',
        folder_id: await ownFolder(body.folderId, me),
        owner_id: me.id,
        updated_by: me.id,
        code_text: body.code ?? DEFAULT_CODE,
        config_text: body.config ?? DEFAULT_CONFIG,
        deleted_at: null,
        ydoc: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.json(await getSummary(row.id, me), 201);
  })
  .get('/:id', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    const summary = await getSummary(id, me);
    if (!summary) throw new HTTPException(404, { message: 'Diagram not found' });
    if (!summary.deletedAt) {
      await db
        .insertInto('diagram_visit')
        .values({ user_id: me.id, diagram_id: id, visited_at: new Date() })
        .onConflict((oc) =>
          oc.columns(['user_id', 'diagram_id']).doUpdateSet({ visited_at: new Date() }),
        )
        .execute();
    }
    return c.json(summary);
  })
  .patch('/:id', zValidator('json', patchBody), async (c) => {
    const id = assertUuid(c.req.param('id'));
    const body = c.req.valid('json');
    const me = c.get('user');
    if (body.folderId !== undefined) {
      await requireRole(id, me, 'owner');
      const folder = await ownFolder(body.folderId, me);
      await db.updateTable('diagram').set({ folder_id: folder }).where('id', '=', id).execute();
    }
    if (body.title !== undefined) {
      await requireRole(id, me, 'editor');
      await db.updateTable('diagram').set({ title: body.title }).where('id', '=', id).execute();
      // Keep the live doc's title in sync so everyone editing sees it immediately.
      await editDoc(id, (doc) => doc.getMap(YDOC.meta).set('title', body.title), me);
    }
    return c.json(await getSummary(id, me));
  })
  .post('/:id/duplicate', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    const role = await requireRole(id, me, 'viewer');
    const src = await db
      .selectFrom('diagram')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const row = await db
      .insertInto('diagram')
      .values({
        title: `${src.title} (copy)`.slice(0, 200),
        // The copy is yours alone; keep the folder only if it was already yours.
        folder_id: role === 'owner' ? src.folder_id : null,
        owner_id: me.id,
        updated_by: me.id,
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
    const me = c.get('user');
    const permanent = c.req.query('permanent') === '1';
    await requireRole(id, me, 'owner', { allowDeleted: true });
    if (permanent) {
      const res = await db
        .deleteFrom('diagram')
        .where('id', '=', id)
        .where('deleted_at', 'is not', null)
        .executeTakeFirst();
      if (!res.numDeletedRows)
        throw new HTTPException(409, { message: 'Move the diagram to the trash first' });
    } else {
      await db
        .updateTable('diagram')
        .set({ deleted_at: new Date() })
        .where('id', '=', id)
        .execute();
      closeDiagram(id);
    }
    return c.body(null, 204);
  })
  .post('/:id/restore', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    await requireRole(id, me, 'owner', { allowDeleted: true });
    await db.updateTable('diagram').set({ deleted_at: null }).where('id', '=', id).execute();
    return c.json(await getSummary(id, me));
  })
  .put('/:id/star', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    await requireRole(id, me, 'viewer');
    await db
      .insertInto('diagram_star')
      .values({ user_id: me.id, diagram_id: id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return c.body(null, 204);
  })
  .delete('/:id/star', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await db
      .deleteFrom('diagram_star')
      .where('user_id', '=', c.get('user').id)
      .where('diagram_id', '=', id)
      .execute();
    return c.body(null, 204);
  })

  // ---- Members: only the owner can add, change or remove people ----
  .get('/:id/members', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await requireRole(id, c.get('user'), 'viewer');
    return c.json(await listMembers(id));
  })
  .post('/:id/members', zValidator('json', memberBody), async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    await requireRole(id, me, 'owner');
    const { email, role } = c.req.valid('json');
    if (email === me.email.toLowerCase())
      throw new HTTPException(400, { message: 'You already own this board' });
    await db
      .insertInto('diagram_member')
      .values({ diagram_id: id, email, role, added_by: me.id })
      .onConflict((oc) => oc.columns(['diagram_id', 'email']).doUpdateSet({ role }))
      .execute();
    // Role changes apply on reconnect (e.g. editor → viewer becomes read-only).
    disconnectUser(id, email);
    return c.json(await listMembers(id), 201);
  })
  .delete('/:id/members/:email', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const me = c.get('user');
    const email = decodeURIComponent(c.req.param('email')).toLowerCase();
    // The owner can remove anyone; members can remove themselves (leave the board).
    if (email !== me.email.toLowerCase()) await requireRole(id, me, 'owner');
    else await requireRole(id, me, 'viewer');
    await db
      .deleteFrom('diagram_member')
      .where('diagram_id', '=', id)
      .where('email', '=', email)
      .execute();
    disconnectUser(id, email);
    return c.body(null, 204);
  });
