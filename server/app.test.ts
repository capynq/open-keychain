import { afterEach, describe, expect, it } from 'vitest';
import { createApp, projectBodyError } from './app';
import type { ServerConfig } from './config';
const config: ServerConfig = {
  port: 3000,
  host: '127.0.0.1',
  databaseUrl: 'postgres://test',
  authSecret: 'test-secret-that-is-long-enough-for-auth',
  appUrl: 'http://localhost:3000',
  anonymousWeeklyExports: 3,
  paidDailyExports: 200,
  paidMinuteExports: 6,
};
const pool = {
  query: async () => ({ rows: [], rowCount: 0 }),
  connect: async () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => undefined,
  }),
} as never;
describe('hosted API', () => {
  const apps: Array<ReturnType<typeof createApp>> = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });
  it('exposes a health endpoint without requiring a session', async () => {
    const app = createApp(pool, config);
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('rejects malformed or oversized saved projects before persistence', () => {
    expect(projectBodyError({ name: 'ALEX', params: { text: 'ALEX' } })).toBeUndefined();
    expect(projectBodyError({ name: 'ALEX', params: [] })).toBe('INVALID_PROJECT');
    expect(projectBodyError({ name: 'A'.repeat(121), params: {} })).toBe('PROJECT_NAME_TOO_LONG');
    expect(
      projectBodyError({ name: 'ALEX', params: {}, thumbnail: 'x'.repeat(192 * 1024 + 1) }),
    ).toBe('PROJECT_THUMBNAIL_TOO_LARGE');
    expect(projectBodyError({ name: 'ALEX', params: { text: 'x'.repeat(256 * 1024) } })).toBe(
      'PROJECT_TOO_LARGE',
    );
  });
});
