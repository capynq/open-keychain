import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCheckout,
  createPortal,
  currentUser,
  deletePreset,
  getBillingCatalog,
  getBillingStatus,
  listPresets,
  savePreset,
  signOut,
  updatePreset,
} from './hosted-api';

describe('hosted API public contract', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reads the versioned session with credentials and treats 401 as signed out', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ user: null }), { status: 200 }),
    );

    await expect(currentUser()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/session', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('preserves Better Auth sign-out and accepts an empty response', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(signOut()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-out', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: '{}',
    });
  });

  it('uses the versioned billing read endpoints', async () => {
    const catalog = { plans: [] };
    const status = {
      plan: 'free',
      status: 'free',
      entitlements: { presets: true, batch: false },
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }));

    await expect(getBillingCatalog()).resolves.toEqual(catalog);
    await expect(getBillingStatus()).resolves.toEqual(status);
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/billing/catalog', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/billing/status', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('posts checkout and portal requests and returns redirect URLs', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: '/checkout' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: '/portal' }), { status: 200 }));

    await expect(createCheckout({ plan: 'maker', returnUrl: '/profile' })).resolves.toEqual({
      url: '/checkout',
    });
    await expect(createPortal({ returnUrl: '/profile' })).resolves.toEqual({ url: '/portal' });
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/billing/checkout', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: '{"plan":"maker","returnUrl":"/profile"}',
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/billing/portal', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: '{"returnUrl":"/profile"}',
    });
  });

  it('supports versioned preset list, create, update, and delete', async () => {
    const preset = {
      id: 'preset / 1',
      name: 'PLA contour',
      params: { templateId: 'name-keychain' },
      print_profile_id: 'fdm-standard-0.4',
      created_at: '',
      updated_at: '',
    };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ presets: [preset] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ preset }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ preset }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(listPresets()).resolves.toEqual([preset]);
    await expect(
      savePreset('PLA contour', preset.params, preset.print_profile_id),
    ).resolves.toEqual({ preset });
    await expect(updatePreset(preset.id, { name: 'Updated' })).resolves.toEqual({ preset });
    await expect(deletePreset(preset.id)).resolves.toBeUndefined();

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/presets', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/presets', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({
        name: 'PLA contour',
        params: preset.params,
        printProfileId: preset.print_profile_id,
      }),
    });
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/presets/preset%20%2F%201', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
      body: '{"name":"Updated"}',
    });
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/v1/presets/preset%20%2F%201', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    });
  });

  it('does not expose legacy export quota calls', async () => {
    const source = await import('./hosted-api');
    expect(source).not.toHaveProperty('requestExportIntent');
    expect(source).not.toHaveProperty('completeExportIntent');
  });
});
