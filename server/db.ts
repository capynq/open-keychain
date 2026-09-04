import { readFile } from 'node:fs/promises';
import pg from 'pg';
const { Pool } = pg;
export const createPool = (connectionString: string): pg.Pool => {
  return new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 });
};
export const migrate = async (pool: pg.Pool): Promise<void> => {
  const migration = await readFile(new URL('./migrations/001_hosted.sql', import.meta.url), 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const statement of migration
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)) {
      await client.query(statement);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
