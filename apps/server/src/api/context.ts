import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { getSessionUser, type SessionUser } from '../auth.ts';

export type AppEnv = { Variables: { user: SessionUser } };

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = await getSessionUser(c.req.raw.headers);
  if (!user) throw new HTTPException(401, { message: 'Not signed in' });
  c.set('user', user);
  await next();
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string) {
  if (!UUID.test(id)) throw new HTTPException(404, { message: 'Not found' });
  return id;
}
