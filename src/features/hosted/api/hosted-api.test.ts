import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentUser, deletePreset, signOut } from './hosted-api';

describe('hosted API preset mutations', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deletes a preset with credentials and accepts the empty success response', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetch;

    await expect(deletePreset('preset / 1')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith('/api/presets/preset%20%2F%201', {
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
