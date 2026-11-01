import type {
  DiagramMember,
  DiagramSummary,
  DiagramVersion,
  DiagramVersionInfo,
  Folder,
  MemberRole,
  PublicUser,
} from '@gramify/shared';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? data.message ?? res.statusText);
  return data as T;
}

export type LibraryView = 'all' | 'mine' | 'shared' | 'recent' | 'starred' | 'trash';
export type SortKey = 'updated' | 'created' | 'title';

export interface AppConfig {
  name: string;
  google: boolean;
  devLogin: boolean;
  contactEmail: string | null;
}

export const api = {
  config: () => request<AppConfig>('GET', '/config'),
  me: () => request<PublicUser>('GET', '/me'),
  devSignIn: (email: string, name: string) =>
    request<unknown>('POST', '/auth/dev/sign-in', { email, name }),

  listDiagrams: (p: {
    view: LibraryView;
    folderId?: string | null;
    q?: string;
    sort?: SortKey;
  }) => {
    const qs = new URLSearchParams({ view: p.view, sort: p.sort ?? 'updated' });
    if (p.folderId) qs.set('folderId', p.folderId);
    if (p.q) qs.set('q', p.q);
    return request<{ diagrams: DiagramSummary[]; presence: Record<string, PublicUser[]> }>(
      'GET',
      `/diagrams?${qs}`,
    );
  },
  getDiagram: (id: string) => request<DiagramSummary>('GET', `/diagrams/${id}`),
  createDiagram: (b: {
    title?: string;
    folderId?: string | null;
    code?: string;
    config?: string;
  }) => request<DiagramSummary>('POST', '/diagrams', b),
  updateDiagram: (id: string, b: { title?: string; folderId?: string | null }) =>
    request<DiagramSummary>('PATCH', `/diagrams/${id}`, b),
  duplicateDiagram: (id: string) => request<DiagramSummary>('POST', `/diagrams/${id}/duplicate`),
  trashDiagram: (id: string) => request<void>('DELETE', `/diagrams/${id}`),
  deleteForever: (id: string) => request<void>('DELETE', `/diagrams/${id}?permanent=1`),
  restoreDiagram: (id: string) => request<DiagramSummary>('POST', `/diagrams/${id}/restore`),
  star: (id: string, on: boolean) => request<void>(on ? 'PUT' : 'DELETE', `/diagrams/${id}/star`),

  listMembers: (id: string) => request<DiagramMember[]>('GET', `/diagrams/${id}/members`),
  addMember: (id: string, email: string, role: MemberRole) =>
    request<DiagramMember[]>('POST', `/diagrams/${id}/members`, { email, role }),
  removeMember: (id: string, email: string) =>
    request<void>('DELETE', `/diagrams/${id}/members/${encodeURIComponent(email)}`),

  listFolders: () => request<Folder[]>('GET', '/folders'),
  createFolder: (name: string, parentId: string | null) =>
    request<Folder>('POST', '/folders', { name, parentId }),
  updateFolder: (id: string, b: { name?: string; parentId?: string | null }) =>
    request<Folder>('PATCH', `/folders/${id}`, b),
  deleteFolder: (id: string) => request<void>('DELETE', `/folders/${id}`),

  listVersions: (id: string) => request<DiagramVersionInfo[]>('GET', `/diagrams/${id}/versions`),
  getVersion: (id: string, vid: string) =>
    request<Pick<DiagramVersion, 'id' | 'code' | 'config'>>(
      'GET',
      `/diagrams/${id}/versions/${vid}`,
    ),
  saveVersion: (id: string, name: string) =>
    request<{ id: string }>('POST', `/diagrams/${id}/versions`, { name }),
  renameVersion: (id: string, vid: string, name: string) =>
    request<void>('PATCH', `/diagrams/${id}/versions/${vid}`, { name }),
  deleteVersion: (id: string, vid: string) =>
    request<void>('DELETE', `/diagrams/${id}/versions/${vid}`),
  restoreVersion: (id: string, vid: string) =>
    request<void>('POST', `/diagrams/${id}/versions/${vid}/restore`),
};
