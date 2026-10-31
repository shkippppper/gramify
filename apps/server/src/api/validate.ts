import type { Context, MiddlewareHandler, ValidationTargets } from 'hono';
import { validator } from 'hono/validator';
import type { z } from 'zod';

/** Tiny zod validator middleware (avoids an extra dependency). */
export function zValidator<T extends keyof ValidationTargets, S extends z.ZodType>(target: T, schema: S) {
  return validator(target, (value, c: Context) => {
    const res = schema.safeParse(value);
    if (!res.success) {
      return c.json({ error: 'Invalid request', issues: res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
    }
    return res.data as z.infer<S>;
  }) as MiddlewareHandler<any, string, { in: { [K in T]: z.input<S> }; out: { [K in T]: z.infer<S> } }>;
}
