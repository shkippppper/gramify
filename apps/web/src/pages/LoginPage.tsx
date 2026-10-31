import { useQueryClient } from '@tanstack/react-query';
import { BRAND } from '@gramify/shared';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { BrandIcon } from '../components/BrandIcon';
import { ThemeToggle } from '../components/TopBar';
import { Button, Input, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { authClient, FullPageSpinner, useAppConfig, useMe } from '../lib/auth';

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const me = useMe();
  const config = useAppConfig();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));

  if (me.isPending || config.isPending) return <FullPageSpinner />;
  if (me.data) return <Navigate to={next} replace />;

  return (
    <div className="relative grid h-full place-items-center p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandIcon className="size-16" />
          <div>
            <h1 className="tp-wordmark text-3xl">{BRAND.name}</h1>
            <p className="text-sm text-muted">{BRAND.tagline}</p>
          </div>
        </div>
        {config.data?.google && (
          <Button
            variant="secondary"
            className="h-10 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await authClient.signIn.social({
                provider: 'google',
                callbackURL: next,
                errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
              });
              if (res.error) {
                setError(
                  res.error.status === 429
                    ? 'Too many sign-in attempts. Wait a few seconds and try again.'
                    : (res.error.message ?? 'Sign-in failed'),
                );
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : <GoogleIcon />} Continue with Google
          </Button>
        )}
        {config.data?.devLogin && (
          <form
            className="mt-4 space-y-2 border-t border-dashed border-border pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api.devSignIn(email.trim(), name.trim());
                await qc.invalidateQueries({ queryKey: ['me'] });
                navigate(next, { replace: true });
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-xs font-medium text-muted">Development sign-in</p>
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full"
              aria-label="Name"
            />
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
              aria-label="Email"
            />
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              Sign in
            </Button>
          </form>
        )}
        {!config.data?.google && !config.data?.devLogin && (
          <p className="text-center text-sm text-muted">
            Sign-in is not configured. Set the Google OAuth variables on the server.
          </p>
        )}
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        <p className="mt-6 text-center text-xs text-muted">
          By continuing you agree to the{' '}
          <Link to="/terms" className="underline hover:text-accent">
            terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-accent">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
