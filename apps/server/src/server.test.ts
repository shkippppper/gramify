import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { docNameFor, YDOC } from '@tidepool/shared';
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
  return {
    doc,
    synced,
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
    expect((await ada.call('GET', `/diagrams?folderId=${child.id}`)).body.diagrams).toHaveLength(1);
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
