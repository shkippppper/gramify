import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/** Content of one version, fetched on demand (versions are immutable, so cache forever). */
export function useVersionContent(diagramId: string, versionId: string | null | undefined) {
  return useQuery({
    queryKey: ['version-content', diagramId, versionId],
    queryFn: () => api.getVersion(diagramId, versionId!),
    enabled: !!versionId,
    staleTime: Infinity,
  });
}
