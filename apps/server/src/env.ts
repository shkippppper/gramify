import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /** Optional: restrict sign-in to these Google Workspace domains (comma-separated). */
  ALLOWED_GOOGLE_DOMAIN: z.string().default(''),
  DEV_LOGIN: bool,
  /** Shown on the privacy policy and terms pages. */
  CONTACT_EMAIL: z.string().default(''),
  /** Directory with the built SPA (apps/web/dist) to serve in production. */
  STATIC_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Invalid environment:\n' +
      parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

// BETTER_AUTH_URL must be the exact public origin: Google compares the derived redirect URI
// character for character. Normalise the common mistakes instead of failing sign-in.
{
  const u = new URL(env.BETTER_AUTH_URL);
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (isProd && u.protocol === 'http:' && !local) {
    console.warn(
      `BETTER_AUTH_URL uses http://; using https://${u.host} (public hosts are served over HTTPS).`,
    );
    u.protocol = 'https:';
  }
  if (u.pathname !== '/' || u.search) {
    console.warn(`BETTER_AUTH_URL should be just the origin; ignoring "${u.pathname}${u.search}".`);
  }
  env.BETTER_AUTH_URL = u.origin;
}
console.log(
  `Public URL: ${env.BETTER_AUTH_URL} (Google redirect URI: ${env.BETTER_AUTH_URL}/api/auth/callback/google)`,
);
export const allowedDomains = env.ALLOWED_GOOGLE_DOMAIN.split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
export const devLoginEnabled = env.DEV_LOGIN && !isProd;
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

if (env.DEV_LOGIN && isProd) console.warn('DEV_LOGIN is ignored in production.');
if (googleEnabled && allowedDomains.length === 0) {
  console.log('Google sign-in is open to any Google account; boards are private until shared.');
}
