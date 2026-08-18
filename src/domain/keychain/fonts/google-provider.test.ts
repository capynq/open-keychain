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
});
