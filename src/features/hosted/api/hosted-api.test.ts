import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentUser, deleteProject, signOut } from './hosted-api';

describe('hosted API project mutations', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deletes a project with credentials and accepts the empty success response', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetch;

    await expect(deleteProject('project / 1')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith('/api/projects/project%20%2F%201', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    });
  });

  it('accepts Better Auth sign-out responses without a JSON body', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(signOut()).resolves.toBeUndefined();
  });

  it('treats only an unauthorized account lookup as signed out', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
    );
    await expect(currentUser()).resolves.toBeUndefined();

    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'DATABASE_DOWN' }), { status: 503 }),
    );
    await expect(currentUser()).rejects.toMatchObject({ status: 503 });
  });
});
