import { describe, expect, it } from 'vitest';

import { decodeDesignDocument, encodeDesignDocument } from './design-document';
import { DEFAULT_PARAMS, normalizeParams } from './model/types';

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
  it.each(['articulated-name', 'nameplate', 'plant-label', 'magnet'] as const)(
    'encodes normalized %s template parameters',
    (templateId) => {
      const params = normalizeParams({ ...DEFAULT_PARAMS, templateId });
      const encoded = encodeDesignDocument({ version: 5, params });

      expect(decodeDesignDocument(encoded)?.params.templateId).toBe(templateId);
    },
  );
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

  it('falls back independently when only the subtitle font is not portable', () => {
    const encoded = encodeDesignDocument({
      version: 5,
      params: { ...DEFAULT_PARAMS, subtitle: 'MAKER', subtitleFontId: 'local-font' },
    });

    expect(decodeDesignDocument(encoded)).toMatchObject({
      fontFallback: true,
      params: { fontId: DEFAULT_PARAMS.fontId, subtitleFontId: DEFAULT_PARAMS.subtitleFontId },
    });
  });

  it('round-trips every compact parameter key in the v5 payload', () => {
    const params = normalizeParams({
      ...DEFAULT_PARAMS,
      text: 'MIRA',
      subtitle: 'LAB',
      subtitleFontId: 'caveat',
      subtitleOffsetXRatio: 0.25,
      subtitleOffsetYRatio: -0.25,
      magnetPocketPreset: '12x3',
      magnetPocketPlacement: 'upper',
      fontId: 'caveat',
      templateId: 'magnet',
      styleId: 'plain',
      textSizeMm: 18,
      fontWeightMm: 0.8,
      baseThicknessMm: 4.6,
      reliefDepthMm: 1.1,
      paddingMm: 3,
      edgeInsetMm: 1,
      letterSpacingMm: 1.2,
      holeDiameterMm: 6,
      connectorWidthMm: 2,
      cornerRadiusMm: 5,
      stakeLengthMm: 55,
      plantAccentEnabled: false,
      nameplateTiltDeg: 8,
      nameplateEmbedMm: 0.5,
      reliefHaloMm: 0.5,
      ringOffsetMm: 1,
      bubbleLobeMm: 1,
      tagTailMm: 2,
      archCurveMm: 2,
      ribbonTailMm: 14,
      ribbonNotchMm: 5,
      subtitleTextSizeMm: 7,
      subtitleFontWeightMm: 0.4,
      subtitleLetterSpacingMm: 0.7,
      subtitleReliefDepthMm: 0.9,
      subtitleGapMm: 2,
    });
    const encoded = encodeDesignDocument({ version: 5, params });

    expect(decodeDesignDocument(encoded)?.params).toEqual(params);
  });
});
