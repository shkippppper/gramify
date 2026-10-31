import type { DiagramRole } from '@gramify/shared';
import { HTTPException } from 'hono/http-exception';
import { sql } from 'kysely';
import type { SessionUser } from './auth.ts';
import { db } from './db/index.ts';

const RANK: Record<DiagramRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** The user's role on a board, or null if they have no access. Includes trashed boards. */
export async function roleFor(
  diagramId: string,
  user: Pick<SessionUser, 'id' | 'email'>,
): Promise<{ role: DiagramRole; deleted: boolean } | null> {
  const row = await db
    .selectFrom('diagram as d')
    .leftJoin('diagram_member as m', (j) =>
      j.onRef('m.diagram_id', '=', 'd.id').on('m.email', '=', user.email.toLowerCase()),
    )
    .select(['d.owner_id', 'd.deleted_at', 'm.role'])
    .where('d.id', '=', diagramId)
    .executeTakeFirst();
  if (!row) return null;
  if (row.owner_id === user.id) return { role: 'owner', deleted: !!row.deleted_at };
  if (row.role) return { role: row.role, deleted: !!row.deleted_at };
  return null;
}

/**
 * Throw unless the user has at least `min` access to a live (non-trashed) board.
 * Unknown and forbidden boards both look like 404 so their existence isn't leaked.
 */
export async function requireRole(
  diagramId: string,
  user: Pick<SessionUser, 'id' | 'email'>,
  min: DiagramRole,
  opts: { allowDeleted?: boolean } = {},
): Promise<DiagramRole> {
  const r = await roleFor(diagramId, user);
  if (!r || (r.deleted && !opts.allowDeleted))
    throw new HTTPException(404, { message: 'Diagram not found' });
  if (RANK[r.role] < RANK[min]) {
    throw new HTTPException(403, {
      message:
        min === 'owner'
          ? 'Only the board owner can do that'
          : 'You only have view access to this board',
    });
  }
  return r.role;
}

/** SQL expression: the current user's role on `d` (owner/editor/viewer) or null. */
export const roleExpr = (user: Pick<SessionUser, 'id' | 'email'>) =>
  sql<DiagramRole | null>`case when d.owner_id = ${user.id} then 'owner'
    else (select m.role from diagram_member m where m.diagram_id = d.id and m.email = ${user.email.toLowerCase()}) end`;
