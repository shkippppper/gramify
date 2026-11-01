import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { BRAND } from '@gramify/shared';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { diagrams } from './api/diagrams.ts';
import { folders } from './api/folders.ts';
import { versions } from './api/versions.ts';
import { getAuth, getSessionUser } from './auth.ts';
import { hocuspocus, pruneVersions } from './collab.ts';
import { db } from './db/index.ts';
import { migrate } from './db/migrate.ts';
import { devLoginEnabled, env, googleEnabled, isProd } from './env.ts';

export async function createServer(port = env.PORT) {
  const app = new Hono();
  if (!isProd) app.use('/api/*', logger());
  app.use(
    '*',
    secureHeaders({
      // Monaco and mermaid inject inline styles; keep CSP off rather than half-working.
      contentSecurityPolicy: undefined,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Mutating API calls must come from our own pages. Browsers always send Origin on
  // non-GET requests, so a cross-site form/fetch riding on the session cookie is refused.
  const appOrigin = new URL(env.BETTER_AUTH_URL).origin;
  app.use('/api/*', async (c, next) => {
    const m = c.req.method;
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      const origin = c.req.header('origin');
      if (origin && origin !== appOrigin)
        return c.json({ error: 'Cross-origin request refused' }, 403);
    }
    await next();
  });
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 2 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Request too large' }, 413),
    }),
  );

  app.get('/api/health', async (c) => {
    await db.selectNoFrom((eb) => eb.val(1).as('ok')).execute();
    return c.json({ ok: true });
  });
  app.get('/api/config', (c) =>
    c.json({
      name: BRAND.name,
      google: googleEnabled,
      devLogin: devLoginEnabled,
      contactEmail: env.CONTACT_EMAIL || null,
    }),
  );
  app.on(['GET', 'POST'], '/api/auth/*', (c) => getAuth().handler(c.req.raw));
  app.get('/api/me', async (c) => {
    const user = await getSessionUser(c.req.raw.headers);
    return user ? c.json(user) : c.json({ error: 'Not signed in' }, 401);
  });
  app.route('/api/diagrams', diagrams);
  app.route('/api/diagrams', versions);
  app.route('/api/folders', folders);
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // Production: serve the built SPA with an index.html fallback for client routes.
  if (env.STATIC_DIR) {
    const root = resolve(env.STATIC_DIR);
    const indexHtml = await readFile(join(root, 'index.html'), 'utf8');
    app.use('/assets/*', async (c, next) => {
      await next();
      if (c.res.ok) c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    });
    // The HTML shell must never be cached: after a deploy it has to point at the new
    // hashed asset files (old ones disappear with the old container).
    app.use('*', async (c, next) => {
      await next();
      if ((c.res.headers.get('content-type') ?? '').includes('text/html')) {
        c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    });
    app.use('*', serveStatic({ root }));
    app.get('*', (c) => c.html(indexHtml));
  }

  await migrate();

  const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
  await new Promise<void>((r) => server.once('listening', () => r()));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  // ---- Realtime collaboration over WebSocket at /collab ----------------------
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 });

  function toRequest(req: IncomingMessage) {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v != null) headers.set(k, v);
    }
    return new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
      headers,
    });
  }

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/collab') {
      socket.destroy();
      return;
    }
    try {
      const request = toRequest(req);
      // Same-origin check: the session cookie is only trusted from our own pages.
      const origin = req.headers.origin;
      if (origin && new URL(env.BETTER_AUTH_URL).origin !== origin && isProd) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      const user = await getSessionUser(request.headers);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const conn = hocuspocus.handleConnection(ws, request, { user });
        ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
          const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
          conn.handleMessage(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        });
        ws.on('close', (code, reason) => conn.handleClose({ code, reason: reason.toString() }));
        ws.on('pong', () => conn.touch());
        ws.on('error', (e) => console.error('[collab] socket error', e.message));
        const ping = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 15_000);
        // Re-check the session periodically: signing out or a revoked session ends live access.
        const recheck = setInterval(() => {
          getSessionUser(request.headers)
            .then((u) => {
              if (!u && ws.readyState === ws.OPEN) ws.close(4401, 'Session ended');
            })
            .catch(() => undefined);
        }, 5 * 60_000);
        ws.on('close', () => {
          clearInterval(ping);
          clearInterval(recheck);
        });
      });
    } catch (e) {
      console.error('[collab] upgrade failed', e);
      socket.destroy();
    }
  });

  // Thin out automatic versions hourly.
  const pruneTimer = setInterval(
    () => {
      pruneVersions()
        .then((n) => n && console.log(`[versions] pruned ${n} automatic versions`))
        .catch((e) => console.error('[versions] prune failed', e));
    },
    60 * 60 * 1000,
  ).unref();

  async function close() {
    clearInterval(pruneTimer);
    // Closing every connection makes Hocuspocus store and unload each open document;
    // wait (bounded) until they are all gone so no edits are lost before the pool closes.
    hocuspocus.closeConnections();
    hocuspocus.flushPendingStores();
    const deadline = Date.now() + 15_000;
    while (hocuspocus.getDocumentsCount() > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (hocuspocus.getDocumentsCount() > 0)
      console.warn(`[shutdown] ${hocuspocus.getDocumentsCount()} documents still open`);
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => server.close(() => r()));
  }

  return { app, server, port: actualPort, close };
}
