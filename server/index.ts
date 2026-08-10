import { createApp } from './app';
import { serverConfig } from './config';
import { createPool, migrate } from './db';
const config = serverConfig();
const pool = createPool(config.databaseUrl);
await migrate(pool);
const app = createApp(pool, config);
const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
await app.listen({ port: config.port, host: config.host });
