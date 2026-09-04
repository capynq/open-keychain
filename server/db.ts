import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool } = pg;
export const createPool = (connectionString: string): pg.Pool => {
  return new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 });
};
export const migrate = async (pool: pg.Pool): Promise<void> => {
  const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
  const migrations = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of migrations) {
    const migration = await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of migration
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean))
      await pool.query(statement);
  }
};
