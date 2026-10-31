import { YDOC, type DiagramVersion } from '@gramify/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type * as Y from 'yjs';
import { currentContent, editDoc, insertVersion, takeContributors } from '../collab.ts';
import { requireRole } from '../access.ts';
import { db } from '../db/index.ts';
import { assertUuid, requireUser, type AppEnv } from './context.ts';
import { zValidator } from './validate.ts';

/** Replace a Y.Text's content with a minimal edit at the differing middle. */
export function replaceYText(ytext: Y.Text, next: string) {
  const prev = ytext.toString();
  if (prev === next) return;
  let s = 0;
  while (s < prev.length && s < next.length && prev[s] === next[s]) s++;
  let ep = prev.length;
  let en = next.length;
  while (ep > s && en > s && prev[ep - 1] === next[en - 1]) {
    ep--;
    en--;
  }
  if (ep > s) ytext.delete(s, ep - s);
  if (en > s) ytext.insert(s, next.slice(s, en));
}

async function listVersions(diagramId: string): Promise<DiagramVersion[]> {
  const rows = await db
    .selectFrom('diagram_version as v')
    .leftJoin('user as u', 'u.id', 'v.created_by')
    .select([
      'v.id',
      'v.diagram_id',
      'v.kind',
      'v.name',
      'v.code_text',
      'v.config_text',
      'v.created_at',
      'v.created_by',
      'v.contributors',
      'u.name as user_name',
      'u.email as user_email',
      'u.image as user_image',
    ])
    .where('v.diagram_id', '=', diagramId)
    .orderBy('v.created_at', 'desc')
    .limit(500)
    .execute();
  const ids = [...new Set(rows.flatMap((r) => r.contributors))];
  const users = ids.length
    ? await db
        .selectFrom('user')
        .select(['id', 'name', 'email', 'image'])
        .where('id', 'in', ids)
        .execute()
    : [];
  const byId = new Map(
    users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email, image: u.image }]),
  );
  return rows.map((r) => ({
    id: r.id,
    diagramId: r.diagram_id,
    kind: r.kind,
    name: r.name,
    code: r.code_text,
    config: r.config_text,
    createdAt: r.created_at.toISOString(),
    createdBy:
      r.created_by && r.user_name && r.user_email
        ? { id: r.created_by, name: r.user_name, email: r.user_email, image: r.user_image }
        : null,
    contributors: r.contributors.map((id) => byId.get(id)).filter((u) => !!u),
  }));
}

const nameBody = z.object({ name: z.string().trim().min(1).max(120) });

export const versions = new Hono<AppEnv>()
  .use(requireUser)
  .get('/:id/versions', async (c) => {
    const id = assertUuid(c.req.param('id'));
    await requireRole(id, c.get('user'), 'viewer');
    return c.json(await listVersions(id));
  })
  .post('/:id/versions', zValidator('json', nameBody), async (c) => {
    const id = assertUuid(c.req.param('id'));
    await requireRole(id, c.get('user'), 'editor');
    const content = await currentContent(id);
    if (!content) throw new HTTPException(404, { message: 'Diagram not found' });
    const me = c.get('user');
    const contributors = new Set([...(await takeContributors(id)), me.id]);
    const vid = await insertVersion(id, 'named', content, {
      name: c.req.valid('json').name,
      createdBy: me.id,
      contributors: [...contributors],
    });
    return c.json({ id: vid }, 201);
  })
  .patch('/:id/versions/:vid', zValidator('json', nameBody), async (c) => {
    const id = assertUuid(c.req.param('id'));
    const vid = assertUuid(c.req.param('vid'));
    await requireRole(id, c.get('user'), 'editor');
    // Naming an automatic version promotes it so it's never pruned.
    const res = await db
      .updateTable('diagram_version')
      .set({ name: c.req.valid('json').name, kind: 'named' })
      .where('id', '=', vid)
      .where('diagram_id', '=', id)
      .executeTakeFirst();
    if (!res.numUpdatedRows) throw new HTTPException(404, { message: 'Version not found' });
    return c.body(null, 204);
  })
  .delete('/:id/versions/:vid', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const vid = assertUuid(c.req.param('vid'));
    await requireRole(id, c.get('user'), 'owner');
    await db
      .deleteFrom('diagram_version')
      .where('id', '=', vid)
      .where('diagram_id', '=', id)
      .execute();
    return c.body(null, 204);
  })
  .post('/:id/versions/:vid/restore', async (c) => {
    const id = assertUuid(c.req.param('id'));
    const vid = assertUuid(c.req.param('vid'));
    await requireRole(id, c.get('user'), 'editor');
    const target = await db
      .selectFrom('diagram_version')
      .selectAll()
      .where('id', '=', vid)
      .where('diagram_id', '=', id)
      .executeTakeFirst();
    if (!target) throw new HTTPException(404, { message: 'Version not found' });
    const me = c.get('user');
    const current = await currentContent(id);
    if (current && (current.code !== target.code_text || current.config !== target.config_text)) {
      const label = target.name ?? target.created_at.toISOString().slice(0, 16).replace('T', ' ');
      const contributors = await takeContributors(id);
      await insertVersion(id, 'restore', current, {
        name: `Before restoring “${label}”`,
        createdBy: me.id,
        contributors,
      });
    }
    await editDoc(
      id,
      (doc) => {
        replaceYText(doc.getText(YDOC.code), target.code_text);
        replaceYText(doc.getText(YDOC.config), target.config_text);
      },
      me,
    );
    return c.body(null, 204);
  });
