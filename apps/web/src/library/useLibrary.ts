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
      if (success) toast.success(success);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}
