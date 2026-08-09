import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString: string): pg.Pool {
  return new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
}

export async function migrate(pool: pg.Pool): Promise<void> {
  const path = fileURLToPath(new URL('./migrations/001_hosted.sql', import.meta.url));
  const migration = await readFile(path, 'utf8');
  for (const statement of migration
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean))
    await pool.query(statement);
}
