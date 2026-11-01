import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { docNameFor, YDOC } from '@gramify/shared';
import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { replaceYText } from './api/versions.ts';

const ORIGIN = 'http://localhost:5173';
let base = '';
let wsBase = '';
let close: () => Promise<void>;
let destroyDb: () => Promise<void>;

beforeAll(async () => {
  // Fresh schema for every run.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  const { createServer } = await import('./app.ts');
  const { db } = await import('./db/index.ts');
  const srv = await createServer(0);
  base = `http://127.0.0.1:${srv.port}`;
  wsBase = `ws://127.0.0.1:${srv.port}`;
  close = srv.close;
  destroyDb = () => db.destroy();
});

afterAll(async () => {
  await close?.();
  await destroyDb?.();
});

async function signIn(email: string, name: string) {
  const res = await fetch(`${base}/api/auth/dev/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, name }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { cookie, origin: ORIGIN, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  };
  return { cookie, call };
}

function connect(diagramId: string, cookie: string, name: string) {
  const doc = new Y.Doc();
  class CookieWS extends WebSocket {
    constructor(url: string) {
      super(url, { headers: { cookie, origin: ORIGIN } });
    }
  }
  const websocketProvider = new HocuspocusProviderWebsocket({
    url: `${wsBase}/collab`,
    WebSocketPolyfill: CookieWS,
  });
  const provider = new HocuspocusProvider({
    websocketProvider,
    name: docNameFor(diagramId),
    document: doc,
  });
  provider.attach(); // required when the websocket is supplied explicitly
  provider.awareness?.setLocalStateField('user', {
    id: name,
    name,
    email: `${name}@example.com`,
    image: null,
    color: '#000',
  });
  const synced = new Promise<void>((resolve) => provider.on('synced', () => resolve()));
  const denied = new Promise<string>((resolve) =>
    provider.on('authenticationFailed', ({ reason }: { reason: string }) => resolve(reason)),
  );
  return {
    doc,
    provider,
    synced,
    denied,
    destroy: () => {
      provider.destroy();
      websocketProvider.destroy();
    },
  };
}

const waitFor = async (fn: () => boolean | Promise<boolean>, ms = 8000) => {
  const start = Date.now();
  while (!(await fn())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('replaceYText', () => {
  it('edits only the differing middle', () => {
    const doc = new Y.Doc();
    const t = doc.getText('t');
    t.insert(0, 'abcXdef');
    replaceYText(t, 'abcYYdef');
    expect(t.toString()).toBe('abcYYdef');
    replaceYText(t, '');
    expect(t.toString()).toBe('');
  });
});

describe('API', () => {
  it('requires a session', async () => {
    const r = await fetch(`${base}/api/diagrams`);
    expect(r.status).toBe(401);
    const me = await fetch(`${base}/api/me`);
    expect(me.status).toBe(401);
  });

  it('creates, searches, stars, trashes and restores diagrams', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const created = await ada.call('POST', '/diagrams', {
      title: 'Payments flow',
      code: 'flowchart LR\n  pay --> settle',
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(created.body.owner.name).toBe('Ada Lovelace');

    expect(
      (await ada.call('GET', '/diagrams?q=settle')).body.diagrams.map((d: { id: string }) => d.id),
    ).toContain(id);
    expect((await ada.call('GET', '/diagrams?q=nomatch')).body.diagrams).toHaveLength(0);

    expect((await ada.call('PUT', `/diagrams/${id}/star`)).status).toBe(204);
    expect((await ada.call('GET', '/diagrams?view=starred')).body.diagrams[0].id).toBe(id);

    await ada.call('GET', `/diagrams/${id}`); // records a visit
    expect((await ada.call('GET', '/diagrams?view=recent')).body.diagrams[0].id).toBe(id);

    expect((await ada.call('DELETE', `/diagrams/${id}`)).status).toBe(204);
    expect(
      (await ada.call('GET', '/diagrams')).body.diagrams.find((d: { id: string }) => d.id === id),
    ).toBeUndefined();
    expect((await ada.call('GET', '/diagrams?view=trash')).body.diagrams[0].id).toBe(id);
    expect((await ada.call('POST', `/diagrams/${id}/restore`)).status).toBe(200);
    expect((await ada.call('POST', `/diagrams/${id}/duplicate`)).body.title).toBe(
      'Payments flow (copy)',
    );
  });

  it('manages folders and prevents cycles', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const parent = (await ada.call('POST', '/folders', { name: 'Platform' })).body;
    const child = (await ada.call('POST', '/folders', { name: 'Auth', parentId: parent.id })).body;
    expect((await ada.call('PATCH', `/folders/${parent.id}`, { parentId: child.id })).status).toBe(
      400,
    );
    const d = (await ada.call('POST', '/diagrams', { title: 'In folder', folderId: child.id }))
      .body;
    expect(
      (await ada.call('GET', `/diagrams?view=mine&folderId=${child.id}`)).body.diagrams,
    ).toHaveLength(1);
    // Deleting a folder moves its diagrams up one level instead of deleting them.
    expect((await ada.call('DELETE', `/folders/${child.id}`)).status).toBe(204);
    expect((await ada.call('GET', `/diagrams/${d.id}`)).body.folderId).toBe(parent.id);
  });

  it('rejects invalid input', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    expect((await ada.call('POST', '/diagrams', { title: '' })).status).toBe(400);
    expect((await ada.call('GET', '/diagrams/not-a-uuid')).status).toBe(404);
  });
});

describe('collaboration', () => {
  it('refuses unauthenticated websocket connections', async () => {
    const code = await new Promise<number | string>((resolve) => {
      const ws = new WebSocket(`${wsBase}/collab`);
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      ws.on('open', () => resolve('open'));
      ws.on('error', () => undefined);
    });
    expect(code).toBe(401);
  });

  it('syncs edits between users, persists them and restores versions', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const grace = await signIn('grace@example.com', 'Grace Hopper');
    const { id } = (
      await ada.call('POST', '/diagrams', { title: 'Live', code: 'graph TD\n  A --> B\n' })
    ).body;
    expect(
      (await ada.call('POST', `/diagrams/${id}/members`, { email: 'grace@example.com' })).status,
    ).toBe(201);

    const a = connect(id, ada.cookie, 'ada');
    const g = connect(id, grace.cookie, 'grace');
    await Promise.all([a.synced, g.synced]);
    expect(g.doc.getText(YDOC.code).toString()).toBe('graph TD\n  A --> B\n');

    // Concurrent edits from both users converge.
    a.doc.getText(YDOC.code).insert(a.doc.getText(YDOC.code).length, '  B --> C\n');
    g.doc.getText(YDOC.code).insert(0, '%% shared\n');
    const expected = '%% shared\ngraph TD\n  A --> B\n  B --> C\n';
    await waitFor(
      () =>
        a.doc.getText(YDOC.code).toString() === expected &&
        g.doc.getText(YDOC.code).toString() === expected,
    );

    // Named version, then a breaking change.
    expect(
      (await grace.call('POST', `/diagrams/${id}/versions`, { name: 'Good state' })).status,
    ).toBe(201);
    a.doc.transact(() => replaceYText(a.doc.getText(YDOC.code), 'pie\n  "x": 1\n'));
    await waitFor(() => g.doc.getText(YDOC.code).toString() === 'pie\n  "x": 1\n');

    // Persisted to Postgres (debounced store).
    await waitFor(
      async () => (await ada.call('GET', `/diagrams/${id}`)).body.code === 'pie\n  "x": 1\n',
      15000,
    );

    // Restore reaches every connected client and records the pre-restore state.
    const versions = (await ada.call('GET', `/diagrams/${id}/versions`)).body as Array<{
      id: string;
      name: string;
      contributors: unknown[];
    }>;
    const good = versions.find((v) => v.name === 'Good state')!;
    expect(good.contributors.length).toBe(2);
    expect((await ada.call('POST', `/diagrams/${id}/versions/${good.id}/restore`)).status).toBe(
      204,
    );
    await waitFor(
      () =>
        g.doc.getText(YDOC.code).toString() === expected &&
        a.doc.getText(YDOC.code).toString() === expected,
    );
    const after = (await ada.call('GET', `/diagrams/${id}/versions`)).body as Array<{
      kind: string;
    }>;
    expect(after.some((v) => v.kind === 'restore')).toBe(true);

    // Renaming over REST updates the live doc title.
    await ada.call('PATCH', `/diagrams/${id}`, { title: 'Renamed live' });
    await waitFor(() => g.doc.getMap(YDOC.meta).get('title') === 'Renamed live');

    a.destroy();
    g.destroy();
  });

  it('prunes old automatic versions but keeps named ones', async () => {
    const { db } = await import('./db/index.ts');
    const { pruneVersions } = await import('./collab.ts');
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Old' })).body;
    const rows = [];
    for (let i = 0; i < 6; i++) {
      // Six autos within the same hour two days ago, plus one named.
      rows.push({
        diagram_id: id,
        kind: 'auto' as const,
        code_text: `v${i}`,
        config_text: '{}',
        created_at: sql<Date>`date_trunc('hour', now() - interval '2 days') + ${i} * interval '1 minute'`,
      });
    }
    await db
      .insertInto('diagram_version')
      .values(rows as never)
      .execute();
    await db
      .insertInto('diagram_version')
      .values({
        diagram_id: id,
        kind: 'named',
        name: 'keep',
        code_text: 'n',
        config_text: '{}',
        created_at: sql<Date>`now() - interval '2 days'`,
      } as never)
      .execute();
    await pruneVersions();
    const left = await db
      .selectFrom('diagram_version')
      .select(['kind'])
      .where('diagram_id', '=', id)
      .execute();
    expect(left.filter((v) => v.kind === 'auto')).toHaveLength(1);
    expect(left.filter((v) => v.kind === 'named')).toHaveLength(1);
  });
});

describe('access control', () => {
  it('keeps boards private until the owner shares them', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const eve = await signIn('eve@example.com', 'Eve');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Secret plan' })).body;

    // Not listed, not readable, not editable, not connectable.
    expect((await eve.call('GET', '/diagrams?q=Secret')).body.diagrams).toHaveLength(0);
    expect((await eve.call('GET', `/diagrams/${id}`)).status).toBe(404);
    expect((await eve.call('PATCH', `/diagrams/${id}`, { title: 'Hacked' })).status).toBe(404);
    expect((await eve.call('GET', `/diagrams/${id}/versions`)).status).toBe(404);
    expect(
      (await eve.call('POST', `/diagrams/${id}/members`, { email: 'eve@example.com' })).status,
    ).toBe(404);
    expect((await eve.call('POST', `/diagrams/${id}/duplicate`)).status).toBe(404);
    const e = connect(id, eve.cookie, 'eve');
    expect(await e.denied).toBeTruthy();
    e.destroy();
  });

  it('lets only the owner manage members, and enforces viewer read-only', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const grace = await signIn('grace@example.com', 'Grace Hopper');
    const linus = await signIn('linus@example.com', 'Linus');
    const { id } = (
      await ada.call('POST', '/diagrams', { title: 'Roadmap', code: 'graph TD\n  A\n' })
    ).body;

    // Members can be added before they ever sign in.
    const added = await ada.call('POST', `/diagrams/${id}/members`, {
      email: 'Grace@Example.com',
      role: 'viewer',
    });
    expect(added.status).toBe(201);
    await ada.call('POST', `/diagrams/${id}/members`, { email: 'newcomer@example.com' });
    const members = (await ada.call('GET', `/diagrams/${id}/members`)).body as Array<{
      email: string;
      role: string;
      user: unknown;
    }>;
    expect(members.map((m) => [m.email, m.role, !!m.user])).toEqual([
      ['grace@example.com', 'viewer', true],
      ['newcomer@example.com', 'editor', false],
    ]);

    // Grace sees it under "shared", as a viewer.
    const shared = (await grace.call('GET', '/diagrams?view=shared')).body.diagrams;
    expect(shared.find((d: { id: string }) => d.id === id)?.role).toBe('viewer');
    expect(
      (await grace.call('GET', '/diagrams?view=mine')).body.diagrams.map(
        (d: { id: string }) => d.id,
      ),
    ).not.toContain(id);

    // Viewers can't rename, save versions, add people, or trash.
    expect((await grace.call('PATCH', `/diagrams/${id}`, { title: 'x' })).status).toBe(403);
    expect((await grace.call('POST', `/diagrams/${id}/versions`, { name: 'x' })).status).toBe(403);
    expect(
      (await grace.call('POST', `/diagrams/${id}/members`, { email: 'linus@example.com' })).status,
    ).toBe(403);
    expect((await grace.call('DELETE', `/diagrams/${id}`)).status).toBe(403);
    // ...but can duplicate into their own private copy.
    const copy = (await grace.call('POST', `/diagrams/${id}/duplicate`)).body;
    expect(copy.role).toBe('owner');
    expect((await ada.call('GET', `/diagrams/${copy.id}`)).status).toBe(404);

    // Viewer connections are read-only: their edits never reach others.
    const a = connect(id, ada.cookie, 'ada');
    const g = connect(id, grace.cookie, 'grace');
    await Promise.all([a.synced, g.synced]);
    g.doc.getText(YDOC.code).insert(0, '%% viewer edit\n');
    a.doc.getText(YDOC.code).insert(0, '%% owner edit\n');
    await waitFor(() => g.doc.getText(YDOC.code).toString().includes('owner edit'));
    await new Promise((r) => setTimeout(r, 500));
    expect(a.doc.getText(YDOC.code).toString()).not.toContain('viewer edit');

    // Editors still can't manage members; only the owner can.
    await ada.call('POST', `/diagrams/${id}/members`, {
      email: 'grace@example.com',
      role: 'editor',
    });
    expect((await grace.call('PATCH', `/diagrams/${id}`, { title: 'Roadmap 2' })).status).toBe(200);
    expect(
      (await grace.call('POST', `/diagrams/${id}/members`, { email: 'linus@example.com' })).status,
    ).toBe(403);
    expect(
      (await grace.call('DELETE', `/diagrams/${id}/members/newcomer%40example.com`)).status,
    ).toBe(403);
    expect((await linus.call('GET', `/diagrams/${id}`)).status).toBe(404);

    // Removing someone revokes access immediately.
    expect((await ada.call('DELETE', `/diagrams/${id}/members/grace%40example.com`)).status).toBe(
      204,
    );
    expect((await grace.call('GET', `/diagrams/${id}`)).status).toBe(404);
    const g2 = connect(id, grace.cookie, 'grace2');
    expect(await g2.denied).toBeTruthy();

    // A member can leave a board on their own.
    await ada.call('POST', `/diagrams/${id}/members`, { email: 'linus@example.com' });
    expect((await linus.call('DELETE', `/diagrams/${id}/members/linus%40example.com`)).status).toBe(
      204,
    );
    expect((await linus.call('GET', `/diagrams/${id}`)).status).toBe(404);

    a.destroy();
    g.destroy();
    g2.destroy();
  });

  it('keeps folders personal', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const eve = await signIn('eve@example.com', 'Eve');
    const folder = (await ada.call('POST', '/folders', { name: 'Ada private folder' })).body;
    expect((await eve.call('GET', '/folders')).body.map((f: { id: string }) => f.id)).not.toContain(
      folder.id,
    );
    expect((await eve.call('PATCH', `/folders/${folder.id}`, { name: 'x' })).status).toBe(404);
    expect((await eve.call('DELETE', `/folders/${folder.id}`)).status).toBe(404);
    expect((await eve.call('POST', '/diagrams', { folderId: folder.id })).status).toBe(400);
  });
});

describe('overhaul regressions', () => {
  it('keeps emoji intact when replacing text', () => {
    const doc = new Y.Doc();
    const t = doc.getText('t');
    t.insert(0, 'a😀b');
    replaceYText(t, 'a😁b');
    expect(t.toString()).toBe('a😁b');
    replaceYText(t, 'a😁😀b');
    expect(t.toString()).toBe('a😁😀b');
  });

  it('rejects non-canonical (upper-case) document names', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Case' })).body;
    const upper = connect(id.toUpperCase(), ada.cookie, 'ada-upper');
    expect(await upper.denied).toBeTruthy();
    upper.destroy();
    // REST accepts either case but always works on the canonical id.
    expect((await ada.call('GET', `/diagrams/${id.toUpperCase()}`)).body.id).toBe(id);
  });

  it('does not duplicate a never-edited board when a client reconnects', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const { id } = (
      await ada.call('POST', '/diagrams', { title: 'Fresh', code: 'graph TD\n  A-->B\n' })
    ).body;
    const first = connect(id, ada.cookie, 'ada1');
    await first.synced;
    const kept = first.doc; // the client keeps its doc across a reconnect
    first.destroy();
    await new Promise((r) => setTimeout(r, 300)); // server unloads the document
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(kept));
    const again = connect(id, ada.cookie, 'ada2');
    Y.applyUpdate(again.doc, Y.encodeStateAsUpdate(doc2));
    await again.synced;
    await new Promise((r) => setTimeout(r, 300));
    expect(again.doc.getText(YDOC.code).toString()).toBe('graph TD\n  A-->B\n');
    again.destroy();
  });

  it('stamps presence with the signed-in identity', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const grace = await signIn('grace@example.com', 'Grace Hopper');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Who' })).body;
    await ada.call('POST', `/diagrams/${id}/members`, {
      email: 'grace@example.com',
      role: 'viewer',
    });
    const a = connect(id, ada.cookie, 'ada');
    const g = connect(id, grace.cookie, 'grace');
    await Promise.all([a.synced, g.synced]);
    // Grace (a viewer) pretends to be Ada.
    g.provider.awareness!.setLocalStateField('user', {
      id: 'x',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      color: '#000',
    });
    await waitFor(() =>
      [...a.provider.awareness!.getStates().entries()].some(
        ([cid, st]) =>
          cid === g.doc.clientID &&
          (st as { user?: { email?: string } }).user?.email === 'grace@example.com',
      ),
    );
    a.destroy();
    g.destroy();
  });

  it('refuses cross-site API writes and hides trashed boards from members', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const grace = await signIn('grace@example.com', 'Grace Hopper');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Origin' })).body;
    const evil = await fetch(`${base}/api/diagrams/${id}/duplicate`, {
      method: 'POST',
      headers: { cookie: ada.cookie, origin: 'https://evil.example' },
    });
    expect(evil.status).toBe(403);
    await ada.call('POST', `/diagrams/${id}/members`, { email: 'grace@example.com' });
    await ada.call('DELETE', `/diagrams/${id}`);
    expect((await grace.call('GET', `/diagrams/${id}`)).status).toBe(404);
    expect((await ada.call('GET', `/diagrams/${id}`)).status).toBe(200);
  });

  it('lists versions without content and serves one version on demand', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'V', code: 'pie\n "a": 1\n' }))
      .body;
    const { id: vid } = (await ada.call('POST', `/diagrams/${id}/versions`, { name: 'v1' })).body;
    const list = (await ada.call('GET', `/diagrams/${id}/versions`)).body;
    expect(list[0]).not.toHaveProperty('code');
    const one = (await ada.call('GET', `/diagrams/${id}/versions/${vid}`)).body;
    expect(one.code).toBe('pie\n "a": 1\n');
  });
});

describe('access changes keep sync alive', () => {
  it('a member whose role changes reconnects and keeps syncing', async () => {
    const ada = await signIn('ada@example.com', 'Ada Lovelace');
    const bob = await signIn('bob@example.com', 'Bob');
    const { id } = (await ada.call('POST', '/diagrams', { title: 'Roles', code: 'graph TD\n' }))
      .body;
    await ada.call('POST', `/diagrams/${id}/members`, { email: 'bob@example.com', role: 'editor' });
    const a = connect(id, ada.cookie, 'ada');
    const b = connect(id, bob.cookie, 'bob');
    await Promise.all([a.synced, b.synced]);
    // Re-saving the role disconnects Bob so access is re-checked…
    await ada.call('POST', `/diagrams/${id}/members`, { email: 'bob@example.com', role: 'editor' });
    await new Promise((r) => setTimeout(r, 300));
    // …and his provider must come back: edits flow both ways again.
    a.doc.getText(YDOC.code).insert(a.doc.getText(YDOC.code).length, '  A-->B\n');
    await waitFor(() => b.doc.getText(YDOC.code).toString().includes('A-->B'), 10000);
    b.doc.getText(YDOC.code).insert(b.doc.getText(YDOC.code).length, '  B-->C\n');
    await waitFor(() => a.doc.getText(YDOC.code).toString().includes('B-->C'), 10000);
    a.destroy();
    b.destroy();
  });
});

describe('board quota', () => {
  it('limits boards per owner (trash included) and empty-trash frees space', async () => {
    const { env } = await import('./env.ts');
    const prev = env.MAX_BOARDS_PER_USER;
    env.MAX_BOARDS_PER_USER = 2;
    try {
      const quinn = await signIn(`quinn.${Date.now()}@example.com`, 'Quinn');
      const a = (await quinn.call('POST', '/diagrams', { title: 'One' })).body;
      await quinn.call('POST', '/diagrams', { title: 'Two' });
      expect((await quinn.call('GET', '/diagrams/usage')).body).toEqual({ used: 2, limit: 2 });
      const third = await quinn.call('POST', '/diagrams', { title: 'Three' });
      expect(third.status).toBe(403);
      expect(third.body.error).toMatch(/up to 2 boards/);
      expect((await quinn.call('POST', `/diagrams/${a.id}/duplicate`)).status).toBe(403);
      // Trashed boards still count until the trash is emptied.
      await quinn.call('DELETE', `/diagrams/${a.id}`);
      expect((await quinn.call('POST', '/diagrams', { title: 'Three' })).status).toBe(403);
      expect((await quinn.call('POST', '/diagrams/empty-trash')).body).toEqual({ deleted: 1 });
      expect((await quinn.call('POST', '/diagrams', { title: 'Three' })).status).toBe(201);
    } finally {
      env.MAX_BOARDS_PER_USER = prev;
    }
  });
});

describe('display names', () => {
  it('lets people rename themselves, trimming and validating the name', async () => {
    const nia = await signIn(`nia.${Date.now()}@example.com`, 'Nia');
    const update = (name: string) =>
      fetch(`${base}/api/auth/update-user`, {
        method: 'POST',
        headers: { cookie: nia.cookie, origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    expect((await update('   ')).status).toBe(400);
    expect((await update('x'.repeat(81))).status).toBe(400);
    expect((await update('  Nia   Okafor  ')).status).toBe(200);
    // Stored tidied (checked via the DB-backed owner name; the test's cookie still caches the old one).
    expect((await nia.call('POST', '/diagrams', { title: 'Mine' })).body.owner.name).toBe(
      'Nia Okafor',
    );
  });
});
