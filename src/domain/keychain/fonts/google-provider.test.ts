import { describe, expect, it, vi } from 'vitest';

import {
  createGoogleFontProvider,
  normalizeGoogleFont,
  selectGoogleVariant,
} from './google-provider';

describe('Google font normalization', () => {
  const record = {
    family: 'Open Sans',
    variants: ['300', 'regular', '700', '700italic'],
    subsets: ['latin', 'cyrillic'],
    files: {
      '400': 'https://fonts.gstatic.com/s/open-sans-regular.ttf',
      '700': 'https://fonts.gstatic.com/s/open-sans-700.ttf',
    },
  } as const;

  it('selects a stable printable variant and carries source metadata', () => {
    expect(selectGoogleVariant(record.variants)).toEqual({ variant: '700', weight: 700 });
    expect(normalizeGoogleFont(record)).toMatchObject({
      id: 'google-open-sans',
      file: record.files['700'],
      scripts: ['latin', 'cyrillic'],
      source: 'google',
      provider: 'google-fonts',
    });
  });

  it('rejects records without a usable non-italic file', () => {
    expect(
      normalizeGoogleFont({ family: 'Only Italic', variants: ['400italic'], files: {} }),
    ).toBeNull();
    expect(
      normalizeGoogleFont({ family: 42 as unknown as string, variants: ['400'], files: {} }),
    ).toBeNull();
    expect(
      normalizeGoogleFont({
        family: 'Bad variants',
        variants: [42] as unknown as string[],
        files: {},
      }),
    ).toBeNull();
    expect(
      normalizeGoogleFont({
        family: 'Unsafe URL',
        variants: ['400'],
        files: { '400': 'https://fonts.gstatic.com:8443/s/font.ttf' },
      }),
    ).toBeNull();
    expect(
      normalizeGoogleFont({ family: 'Missing File', variants: ['400'], files: {} }),
    ).toBeNull();
  });

  it('enforces the allowlist, limit, ordering, and TTL cache', async () => {
    let clock = 100;
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                family: 'Zulu',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/z.ttf' },
              },
              {
                family: 'Alpha',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/a.ttf' },
              },
              {
                family: 'Blocked',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/b.ttf' },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const provider = createGoogleFontProvider({
      allowlist: ['Zulu', 'Alpha'],
      apiKey: 'test-key',
      maxFonts: 1,
      cacheTtlMs: 10,
      now: () => clock,
      fetch,
    });
    expect((await provider.list()).map((font) => font.name)).toEqual(['Alpha']);
    expect((await provider.list()).map((font) => font.name)).toEqual(['Alpha']);
    expect(fetch).toHaveBeenCalledTimes(1);
    clock = 111;
    await provider.list();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('categorizes malformed and oversized responses', async () => {
    const malformed = createGoogleFontProvider({
      apiKey: 'test-key',
      fetch: vi.fn(async () => new Response('{not json', { status: 200 })),
    });
    await expect(malformed.list()).rejects.toMatchObject({
      code: 'invalid-payload',
    });

    const oversized = createGoogleFontProvider({
      apiKey: 'test-key',
      maxResponseBytes: 1,
      fetch: vi.fn(async () => new Response('{}', { status: 200 })),
    });
    await expect(oversized.list()).rejects.toMatchObject({ code: 'payload-too-large' });
  });

  it('reports missing credentials, HTTP failures, and fetch failures distinctly', async () => {
    await expect(createGoogleFontProvider({}).list()).rejects.toMatchObject({
      code: 'missing-api-key',
    });
    await expect(
      createGoogleFontProvider({
        apiKey: 'test-key',
        fetch: vi.fn(async () => new Response(null, { status: 429 })),
      }).list(),
    ).rejects.toMatchObject({ code: 'http', status: 429 });
    await expect(
      createGoogleFontProvider({
        apiKey: 'test-key',
        fetch: vi.fn(async () => Promise.reject(new Error('offline'))),
      }).list(),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('distinguishes a timeout from another network failure', async () => {
    const timedOut = createGoogleFontProvider({
      apiKey: 'test-key',
      timeoutMs: 1,
      fetch: vi.fn(
        (_url: URL | RequestInfo, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    });
    await expect(timedOut.list()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('keeps the timeout active while reading a stalled response body', async () => {
    const stalledBody = createGoogleFontProvider({
      apiKey: 'test-key',
      timeoutMs: 1,
      fetch: vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start: () => undefined,
            }),
            { status: 200 },
          ),
      ),
    });
    await expect(stalledBody.list()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('stops reading an oversized chunked response without a content length', async () => {
    const oversizedChunks = createGoogleFontProvider({
      apiKey: 'test-key',
      maxResponseBytes: 3,
      fetch: vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('more than three bytes'));
                controller.close();
              },
            }),
            { status: 200 },
          ),
      ),
    });
    await expect(oversizedChunks.list()).rejects.toMatchObject({ code: 'payload-too-large' });
  });

  it('uses and clears the session cache', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const first = createGoogleFontProvider({ apiKey: 'test-key', fetch, now: () => 100 });
    await first.list();
    const second = createGoogleFontProvider({ apiKey: 'test-key', fetch, now: () => 100 });
    await second.list();
    expect(fetch).toHaveBeenCalledTimes(1);
    second.clearCache();
    expect(values).toHaveLength(0);
    await second.list();
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('does not share cached results between allowlists or limits', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                family: 'Alpha',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/a.ttf' },
              },
              {
                family: 'Beta',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/b.ttf' },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const alpha = createGoogleFontProvider({
      allowlist: ['Alpha'],
      maxFonts: 1,
      apiKey: 'test-key',
      fetch,
      now: () => 100,
    });
    const beta = createGoogleFontProvider({
      allowlist: ['Beta'],
      maxFonts: 1,
      apiKey: 'test-key',
      fetch,
      now: () => 100,
    });
    const limited = createGoogleFontProvider({
      maxFonts: 2,
      apiKey: 'test-key',
      fetch,
      now: () => 100,
    });
    expect((await alpha.list()).map((font) => font.name)).toEqual(['Alpha']);
    expect((await beta.list()).map((font) => font.name)).toEqual(['Beta']);
    expect((await limited.list()).map((font) => font.name)).toEqual(['Alpha', 'Beta']);
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it('ignores malformed cached font definitions', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                family: 'Alpha',
                variants: ['400'],
                files: { '400': 'https://fonts.gstatic.com/s/a.ttf' },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const options = { apiKey: 'test-key', fetch, now: () => 100 };
    await createGoogleFontProvider(options).list();
    const cacheKey = [...values.keys()].find((key) =>
      key.startsWith('open-keychain:google-fonts:v2:'),
    );
    expect(cacheKey).toBeDefined();
    values.set(cacheKey!, JSON.stringify({ expiresAt: 200, fonts: [{ name: 'tampered' }] }));
    expect((await createGoogleFontProvider(options).list()).map((font) => font.name)).toEqual([
      'Alpha',
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
