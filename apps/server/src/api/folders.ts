import type { Folder } from '@tidepool/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { assertUuid, requireUser, type AppEnv } from './context.ts';
import { zValidator } from './validate.ts';

const toFolder = (r: {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: Date;
}): Folder => ({
  id: r.id,
  name: r.name,
  parentId: r.parent_id,
  createdAt: r.created_at.toISOString(),
});

const body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

/** Would setting `parentId` as the parent of `id` create a cycle? */
async function createsCycle(id: string, parentId: string | null) {
  let cur = parentId;
  for (let i = 0; cur && i < 100; i++) {
    if (cur === id) return true;
    const row = await db
      .selectFrom('folder')
      .select('parent_id')
      .where('id', '=', cur)
      .executeTakeFirst();
    cur = row?.parent_id ?? null;
  }
  return false;
}

export const folders = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', async (c) => {
    const rows = await db.selectFrom('folder').selectAll().orderBy('name').execute();
    return c.json(rows.map(toFolder));
  })
  .post('/', zValidator('json', body), async (c) => {
    const { name, parentId } = c.req.valid('json');
    if (!name) throw new HTTPException(400, { message: 'Name is required' });
    const row = await db
      .insertInto('folder')
      .values({ name, parent_id: parentId ?? null, created_by: c.get('user').id })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(toFolder(row), 201);
  })
  .patch('/:id', zValidator('json', body), async (c) => {
    const id = assertUuid(c.req.param('id'));
    const { name, parentId } = c.req.valid('json');
    if (parentId !== undefined && (await createsCycle(id, parentId))) {
      throw new HTTPException(400, { message: 'A folder cannot be moved into itself' });
    }
    const row = await db
      .updateTable('folder')
      .set({
        ...(name ? { name } : {}),
        ...(parentId !== undefined ? { parent_id: parentId } : {}),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new HTTPException(404, { message: 'Folder not found' });
    return c.json(toFolder(row));
  })
  .delete('/:id', async (c) => {
    const id = assertUuid(c.req.param('id'));
    // Deleting a folder never deletes diagrams: its contents move up one level.
    await db.transaction().execute(async (tx) => {
      const f = await tx
        .selectFrom('folder')
        .select('parent_id')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!f) throw new HTTPException(404, { message: 'Folder not found' });
      await tx
        .updateTable('diagram')
        .set({ folder_id: f.parent_id })
        .where('folder_id', '=', id)
        .execute();
      await tx
        .updateTable('folder')
        .set({ parent_id: f.parent_id })
        .where('parent_id', '=', id)
        .execute();
      await tx.deleteFrom('folder').where('id', '=', id).execute();
    });
    return c.body(null, 204);
  });
