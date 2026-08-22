import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './model/types';
import { decodeDesignDocument, encodeDesignDocument } from './design-document';

describe('design document codec', () => {
  it('round-trips unicode params and appearance', () => {
    const encoded = encodeDesignDocument({
      version: 2,
      params: { ...DEFAULT_PARAMS, text: 'Привіт 🌿' },
      appearanceOverrides: { version: 1, base: '#123456', relief: '#ABCDEF' },
    });
    expect(encoded).toMatch(/^v3\.[A-Za-z0-9_-]+$/);
    expect(decodeDesignDocument(encoded)).toMatchObject({
      version: 2,
      params: { text: 'Привіт 🌿' },
      appearanceOverrides: { base: '#123456', relief: '#ABCDEF' },
    });
  });

  it('uses a compact, explicitly versioned payload', () => {
    const encoded = encodeDesignDocument({ version: 2, params: DEFAULT_PARAMS });
    expect(encoded.startsWith('v3.')).toBe(true);
    expect(encoded.length).toBeLessThan(
      btoa(JSON.stringify({ version: 2, params: DEFAULT_PARAMS })).length,
    );
  });

  it('rejects legacy v1 payloads', () => {
    const legacy = btoa(
      JSON.stringify({ version: 1, params: { ...DEFAULT_PARAMS, text: 'Legacy' } }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(decodeDesignDocument(legacy)).toBeUndefined();
    expect(decodeDesignDocument(`v1.${legacy}`)).toBeUndefined();
    expect(decodeDesignDocument(`v2.${legacy}`)).toBeUndefined();
  });

  it.each(['', 'not-base64', 'eyJ2ZXJzaW9uIjoyfQ', 'A'.repeat(24_001)])(
    'rejects malformed payload %s',
    (value) => expect(decodeDesignDocument(value)).toBeUndefined(),
  );

  it('rejects out-of-range and invalid colors', () => {
    expect(() =>
      encodeDesignDocument({ version: 2, params: { ...DEFAULT_PARAMS, textSizeMm: 31 } }),
    ).toThrow();
    expect(() =>
      encodeDesignDocument({
        version: 2,
        params: DEFAULT_PARAMS,
        appearanceOverrides: { version: 1, base: 'red' as `#${string}` },
      }),
    ).toThrow();
  });

  it('falls back to a bundled font for sharing', () => {
    const encoded = encodeDesignDocument({
      version: 2,
      params: { ...DEFAULT_PARAMS, fontId: 'google-custom-font' },
    });
    expect(decodeDesignDocument(encoded)).toMatchObject({
      fontFallback: true,
      params: { fontId: DEFAULT_PARAMS.fontId },
    });
  });
});
