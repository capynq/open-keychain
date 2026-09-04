import { describe, expect, it, vi } from 'vitest';
import { migrate } from './db';

const createPoolStub = () => {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (query: string) => {
      queries.push(query);
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: vi.fn(async () => client) } as never, client, queries };
};

describe('hosted database migration', () => {
  it('runs the canonical schema in one transaction', async () => {
    const { pool, client, queries } = createPoolStub();

    await migrate(pool);

    expect(queries[0]).toBe('BEGIN');
    expect(queries.at(-1)).toBe('COMMIT');
    expect(
      queries.some((query) => query.includes('CREATE TABLE IF NOT EXISTS seller_presets')),
    ).toBe(true);
    expect(
      queries.some((query) => query.includes('CREATE TABLE IF NOT EXISTS export_events')),
    ).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back and releases the client when a statement fails', async () => {
    const { pool, client, queries } = createPoolStub();
    let statementCount = 0;
    client.query.mockImplementation(async (query: string) => {
      queries.push(query);
      if (
        query !== 'BEGIN' &&
        query !== 'ROLLBACK' &&
        query !== 'COMMIT' &&
        statementCount++ === 0
      ) {
        throw new Error('migration failed');
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(migrate(pool)).rejects.toThrow('migration failed');
    expect(queries.at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
