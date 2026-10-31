import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@tidepool/shared';
import { createAuthClient } from 'better-auth/react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Spinner } from '../components/ui';
import { api, ApiError } from './api';

export const authClient = createAuthClient({ baseURL: window.location.origin });

export function useMe() {
  return useQuery<PublicUser | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity });
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await authClient.signOut();
    qc.clear();
    window.location.href = '/login';
  };
}

export function FullPageSpinner() {
  return (
    <div className="grid h-full place-items-center text-muted">
      <Spinner />
    </div>
  );
}

/** Gate a route behind sign-in, remembering where the user wanted to go. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <FullPageSpinner />;
  if (me.isError) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-danger">
        Could not reach the server: {(me.error as Error).message}
      </div>
    );
  }
  if (!me.data) {
    const next = encodeURIComponent(loc.pathname + loc.search + loc.hash);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
