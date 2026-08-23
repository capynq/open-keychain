import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './model/types';
import { decodeDesignDocument, encodeDesignDocument } from './design-document';

describe('design document codec', () => {
  it('round-trips unicode params and appearance', () => {
    const encoded = encodeDesignDocument({
      version: 5,
      params: { ...DEFAULT_PARAMS, text: 'Привіт 🌿' },
      appearanceOverrides: { version: 1, base: '#123456', relief: '#ABCDEF' },
    });
    expect(encoded).toMatch(/^v5\.[A-Za-z0-9_-]+$/);
    expect(decodeDesignDocument(encoded)).toMatchObject({
      version: 5,
      params: { text: 'Привіт 🌿' },
      appearanceOverrides: { base: '#123456', relief: '#ABCDEF' },
    });
  });

  it('uses a compact, explicitly versioned payload', () => {
    const encoded = encodeDesignDocument({ version: 5, params: DEFAULT_PARAMS });
    expect(encoded.startsWith('v5.')).toBe(true);
    expect(encoded.length).toBeLessThan(
      btoa(JSON.stringify({ version: 2, params: DEFAULT_PARAMS })).length,
    );
  });
  it('round-trips magnet hardware and pocket placement', () => {
    const encoded = encodeDesignDocument({
      version: 5,
      params: {
        ...DEFAULT_PARAMS,
        templateId: 'magnet',
        baseThicknessMm: 4.4,
        magnetPocketPreset: '12x3',
        magnetPocketPlacement: 'upper',
      },
    });
    expect(decodeDesignDocument(encoded)?.params).toMatchObject({
      magnetPocketPreset: '12x3',
      magnetPocketPlacement: 'upper',
    });
  });
  it('round-trips independent subtitle font and placement controls', () => {
    const encoded = encodeDesignDocument({
      version: 5,
      params: {
        ...DEFAULT_PARAMS,
        subtitle: 'ROLE',
        subtitleFontId: 'caveat',
        subtitleTextSizeMm: 9,
        subtitleReliefDepthMm: 1.2,
        subtitleOffsetXRatio: 0.5,
        subtitleOffsetYRatio: -0.25,
      },
    });
    expect(decodeDesignDocument(encoded)?.params).toMatchObject({
      subtitleFontId: 'caveat',
      subtitleTextSizeMm: 9,
      subtitleReliefDepthMm: 1.2,
      subtitleOffsetXRatio: 0.5,
      subtitleOffsetYRatio: -0.25,
    });
  });
  it('rejects invalid magnet preset and placement values', () => {
    expect(() =>
      encodeDesignDocument({
        version: 5,
        params: { ...DEFAULT_PARAMS, magnetPocketPreset: '7x2' as never },
      }),
    ).toThrow();
    expect(() =>
      encodeDesignDocument({
        version: 5,
        params: { ...DEFAULT_PARAMS, magnetPocketPlacement: 'diagonal' as never },
      }),
    ).toThrow();
  });

  it('rejects unversioned and unsupported payloads', () => {
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
      encodeDesignDocument({ version: 5, params: { ...DEFAULT_PARAMS, textSizeMm: 31 } }),
    ).toThrow();
    expect(() =>
      encodeDesignDocument({
        version: 5,
        params: DEFAULT_PARAMS,
        appearanceOverrides: { version: 1, base: 'red' as `#${string}` },
      }),
    ).toThrow();
  });

  it('falls back to a bundled font for sharing', () => {
    const encoded = encodeDesignDocument({
      version: 5,
      params: { ...DEFAULT_PARAMS, fontId: 'google-custom-font' },
    });
    expect(decodeDesignDocument(encoded)).toMatchObject({
      fontFallback: true,
      params: { fontId: DEFAULT_PARAMS.fontId },
    });
  });
});
