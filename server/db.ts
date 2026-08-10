import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool } = pg;
export const createPool = (connectionString: string): pg.Pool => {
  return new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 });
};
export const migrate = async (pool: pg.Pool): Promise<void> => {
  const path = fileURLToPath(new URL('./migrations/001_hosted.sql', import.meta.url));
  const migration = await readFile(path, 'utf8');
  for (const statement of migration
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await pool.query(statement);
};
