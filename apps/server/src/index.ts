import { BRAND } from '@tidepool/shared';
import { createServer } from './app.ts';
import { db } from './db/index.ts';
import { isProd } from './env.ts';

const { port, close } = await createServer();
console.log(`${BRAND.name} listening on :${port} (${isProd ? 'production' : 'development'})`);

async function shutdown(signal: string) {
  console.log(`${signal} received, saving open documents…`);
  await close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
