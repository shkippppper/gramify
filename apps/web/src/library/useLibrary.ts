import type { DiagramSummary, PublicUser } from '@gramify/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type LibraryView, type SortKey } from '../lib/api';

export function useFolders() {
  return useQuery({ queryKey: ['folders'], queryFn: api.listFolders });
}

export function useDiagrams(p: {
  view: LibraryView;
  folderId: string | null;
  q: string;
  sort: SortKey;
}) {
  return useQuery({
    queryKey: ['diagrams', p],
    queryFn: () => api.listDiagrams(p),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000, // keep "who's editing" fresh
  });
}

/** Wraps a mutation that changes library data: refreshes lists and reports errors. */
export function useLibraryMutation<A>(fn: (a: A) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['diagrams'] });
      void qc.invalidateQueries({ queryKey: ['folders'] });
      void qc.invalidateQueries({ queryKey: ['usage'] });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

type ListData = { diagrams: DiagramSummary[]; presence: Record<string, PublicUser[]> };

/** Star/unstar with an optimistic update: the icon flips instantly, then syncs. */
export function useStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DiagramSummary) => api.star(d.id, !d.starred),
    onMutate: async (d) => {
      await qc.cancelQueries({ queryKey: ['diagrams'] });
      const snapshot = qc.getQueriesData<ListData>({ queryKey: ['diagrams'] });
      qc.setQueriesData<ListData>({ queryKey: ['diagrams'] }, (old) =>
        old
          ? {
              ...old,
              diagrams: old.diagrams.map((x) =>
                x.id === d.id ? { ...x, starred: !d.starred } : x,
              ),
            }
          : old,
      );
      return { snapshot };
    },
    onError: (e, _d, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error((e as Error).message);
    },
    // Refresh quietly afterwards (the Starred view gains/loses the board).
    onSettled: () => void qc.invalidateQueries({ queryKey: ['diagrams'] }),
  });
}

/** Boards owned (trash included) vs. the per-person limit (null = unlimited). */
export function useUsage() {
  return useQuery({ queryKey: ['usage'], queryFn: api.usage, staleTime: 30_000 });
}

export const quotaMessage = (limit: number) =>
  `You can have up to ${limit} boards (boards in your trash count too). Delete one forever, or empty your trash, to make room.`;
