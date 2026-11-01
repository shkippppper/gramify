import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import { pool } from './db/index.ts';
import { allowedDomains, devLoginEnabled, env, googleEnabled } from './env.ts';

const emailDomain = (email: string) => email.split('@').pop()?.toLowerCase() ?? '';

/**
 * Passwordless sign-in for local development and e2e tests only.
 * Never registered when NODE_ENV=production.
 */
const devLogin = (): BetterAuthPlugin => ({
  id: 'dev-login',
  endpoints: {
    devSignIn: createAuthEndpoint(
      '/dev/sign-in',
      {
        method: 'POST',
        body: z.object({ email: z.string().email(), name: z.string().min(1).max(80) }),
      },
      async (ctx) => {
        const { email, name } = ctx.body;
        const existing = await ctx.context.internalAdapter.findUserByEmail(email.toLowerCase());
        const user =
          existing?.user ??
          (await ctx.context.internalAdapter.createUser(
            { email: email.toLowerCase(), name, image: null },
            { method: 'admin' },
          ));
        if (!user)
          throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not create user' });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session)
          throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not create session' });
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ user });
      },
    ),
  },
});

export const authOptions = {
  appName: 'Gramify',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: pool,
  trustedOrigins: [env.BETTER_AUTH_URL],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          // Optional Workspace restriction. One domain: Google hint + verified `hd` claim.
          // Several: any Workspace domain, narrowed by the email-domain check below.
          ...(allowedDomains.length
            ? { hd: allowedDomains.length === 1 ? allowedDomains[0] : '*' }
            : {}),
          prompt: 'select_account',
        },
      }
    : {},
  databaseHooks: {
    user: {
      update: {
        // Display names are user-editable: keep them tidy and sane.
        async before(data) {
          if (typeof data.name === 'string') {
            const name = data.name.replace(/\s+/g, ' ').trim();
            if (!name || name.length > 80) {
              throw new APIError('BAD_REQUEST', { message: 'Names must be 1–80 characters.' });
            }
            return { data: { ...data, name } };
          }
          return { data };
        },
      },
      create: {
        async before(user) {
          if (googleEnabled && allowedDomains.length > 0 && !devLoginEnabled) {
            if (!allowedDomains.includes(emailDomain(user.email))) {
              throw new APIError('FORBIDDEN', {
                message: 'This account is not part of an allowed workspace.',
              });
            }
          }
          return { data: user };
        },
      },
    },
  },
  advanced: {
    ipAddress: {
      // Behind Railway's proxy X-Forwarded-For carries several hops, which Better Auth
      // won't guess between; X-Real-IP holds just the client. Without a per-client IP,
      // rate limits fall back to one bucket shared by everyone (429s for all after a
      // few sign-in clicks).
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'],
    },
  },
  plugins: devLoginEnabled ? [devLogin()] : [],
  telemetry: { enabled: false },
} satisfies BetterAuthOptions;

let instance: ReturnType<typeof betterAuth<typeof authOptions>> | undefined;
/** Created lazily so it initialises after migrations have run. */
export function getAuth() {
  return (instance ??= betterAuth(authOptions));
}

export type SessionUser = { id: string; name: string; email: string; image: string | null };

export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const res = await getAuth().api.getSession({ headers });
  if (!res) return null;
  const { id, name, email, image } = res.user;
  return { id, name, email, image: image ?? null };
}
