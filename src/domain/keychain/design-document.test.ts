import { describe, expect, it } from 'vitest';

import { decodeDesignDocument, encodeDesignDocument } from './design-document';
import { createDesignDocument, designParams, DESIGN_SECTIONS } from './model/design-schema';
import { KEYRING_POSITIONS } from './model/keyring-position';
import { DEFAULT_PARAMS, normalizeParams } from './model/types';

const payload = (value: unknown, version = 'v6'): string =>
  `${version}.${btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;

describe('structured design document codec', () => {
  it('assigns every persisted parameter to exactly one semantic section', () => {
    const keys = Object.values(DESIGN_SECTIONS).flat();
    expect([...keys].sort()).toEqual(Object.keys(DEFAULT_PARAMS).sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('round-trips Unicode, independent typography, layout, finishes, and appearance', () => {
    const params = normalizeParams({
      ...DEFAULT_PARAMS,
      text: 'Привіт 🌿',
      subtitle: 'MAKER',
      subtitleFontId: 'caveat',
      subtitleTextSizeMm: 9,
      subtitleFontWeightMm: 0.4,
      subtitleLetterSpacingMm: 1.2,
      subtitleGapMm: 2,
      subtitleReliefDepthMm: 1.2,
      subtitleOffsetXRatio: 0.5,
      subtitleOffsetYRatio: -0.25,
      textEdgeFinish: 'chamfer',
      textEdgeMm: 0.2,
      keyringPosition: 'bottom',
      sizeEnvelope: { widthMm: 100, heightMm: 35 },
    });
    const appearance = { version: 1 as const, base: '#123456', relief: '#ABCDEF' };
    const encoded = encodeDesignDocument(createDesignDocument(params, appearance));
    const decoded = decodeDesignDocument(encoded);
    expect(encoded).toMatch(/^v11\.[A-Za-z0-9_-]+$/);
    expect(decoded && designParams(decoded)).toEqual(params);
    expect(decoded?.appearanceOverrides).toEqual(appearance);
    expect(decoded?.content.text).toBe(params.text);
    expect(decoded?.finish.textEdgeMm).toBe(0.2);
  });

  it.each(KEYRING_POSITIONS)('round-trips the v11 %s keyring position', (keyringPosition) => {
    const encoded = encodeDesignDocument(
      createDesignDocument({ ...DEFAULT_PARAMS, keyringPosition }),
    );
    expect(encoded).toMatch(/^v11\./);
    expect(designParams(decodeDesignDocument(encoded)!)).toMatchObject({ keyringPosition });
  });

  it('omits defaults from the wire payload', () => {
    expect(encodeDesignDocument(createDesignDocument(DEFAULT_PARAMS)).length).toBeLessThan(30);
  });

  it.each(['name-keychain', 'articulated-name', 'nameplate', 'plant-label', 'magnet'] as const)(
    'round-trips normalized %s parameters',
    (templateId) => {
      const params = normalizeParams({ ...DEFAULT_PARAMS, templateId });
      const decoded = decodeDesignDocument(encodeDesignDocument(createDesignDocument(params)));
      expect(decoded && designParams(decoded)).toEqual(params);
    },
  );

  it('round-trips hardware and shaped silhouette parameters', () => {
    const params = normalizeParams({
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'ribbon',
      magnetPocketPreset: '12x3',
      magnetPocketPlacement: 'upper',
      baseThicknessMm: 4.6,
      ribbonTailMm: 14,
      ribbonNotchMm: 5,
      cornerRadiusMm: 5,
      paddingMm: 3,
      edgeInsetMm: 1,
    });
    const decoded = decodeDesignDocument(encodeDesignDocument(createDesignDocument(params)));
    expect(decoded && designParams(decoded)).toEqual(params);
  });

  it('falls back independently for fonts that cannot travel in a shared link', () => {
    const decoded = decodeDesignDocument(
      encodeDesignDocument(
        createDesignDocument({
          ...DEFAULT_PARAMS,
          subtitle: 'MAKER',
          subtitleFontId: 'local-font',
        }),
      ),
    );
    expect(decoded?.fontFallback).toBe(true);
    expect(decoded?.content.fontId).toBe(DEFAULT_PARAMS.fontId);
    expect(decoded?.content.subtitleFontId).toBe(DEFAULT_PARAMS.subtitleFontId);
  });

  it.each(['', 'not-base64', 'v1.e30', 'v2.e30', 'v5.e30', 'A'.repeat(24_001)])(
    'rejects malformed and obsolete payloads: %s',
    (value) => {
      expect(decodeDesignDocument(value)).toBeUndefined();
    },
  );

  it('rejects unknown fields and fields placed in the wrong section', () => {
    expect(decodeDesignDocument(payload({ content: { bogus: 1 } }))).toBeUndefined();
    expect(decodeDesignDocument(payload({ finish: { t: 'MIRA' } }))).toBeUndefined();
    expect(decodeDesignDocument(payload({ p: { t: 'MIRA' } }))).toBeUndefined();
    expect(decodeDesignDocument(payload({ content: [] }))).toBeUndefined();
  });

  it.each([
    { textSizeMm: 31 },
    { magnetPocketPreset: '7x2' as never },
    { magnetPocketPlacement: 'diagonal' as never },
    { keyringPosition: 'diagonal' as never },
    { textEdgeFinish: 'soft' as never },
    { textEdgeMm: 2 },
  ])('rejects invalid parameters %j', (change) => {
    expect(() =>
      encodeDesignDocument(createDesignDocument({ ...DEFAULT_PARAMS, ...change })),
    ).toThrow();
  });

  it('rejects invalid appearance metadata', () => {
    expect(() =>
      encodeDesignDocument(createDesignDocument(DEFAULT_PARAMS, { version: 1, base: 'red' })),
    ).toThrow();
    expect(decodeDesignDocument(payload({ a: { b: '#12345Z' } }))).toBeUndefined();
  });

  it('ignores the removed separate-parts field in legacy v6 compact payloads', () => {
    const decoded = decodeDesignDocument(payload({ manufacturing: { sp: true } }));
    expect(decoded).toBeDefined();
    expect(designParams(decoded!)).toEqual(
      normalizeParams({ ...DEFAULT_PARAMS, keyringPreset: 'custom' }),
    );
    expect(JSON.stringify(decoded)).not.toContain('separateParts');
  });

  it('loads a v6 link with sharp text and no size envelope', () => {
    const decoded = decodeDesignDocument(payload({ finish: { ef: 'round', et: 0.4 } }));
    expect(decoded?.version).toBe(11);
    expect(decoded?.hardware.keyringPreset).toBe('custom');
    expect(decoded?.finish.edgeFinish).toBe('round');
    expect(decoded?.finish.topEdgeMm).toBe(0.4);
    expect(decoded?.finish.textEdgeFinish).toBe('sharp');
    expect(decoded?.layout.sizeEnvelope).toBeUndefined();
    expect(decoded).not.toHaveProperty('backingFinishMigrated');
  });

  it('preserves a legacy v6 text edge when one was explicitly set', () => {
    const decoded = decodeDesignDocument(payload({ finish: { ef: 'chamfer', et: 0.4, er: 0.2 } }));
    expect(decoded?.finish.textEdgeFinish).toBe('chamfer');
    expect(decoded?.finish.textEdgeMm).toBe(0.2);
  });

  it('reads v7 backing fields independently of text finishing', () => {
    const decoded = decodeDesignDocument(
      payload({ finish: { ef: 'round', et: 0.6, eb: 0.4, es: 'chamfer', er: 0.2 } }, 'v7'),
    );
    expect(decoded?.version).toBe(11);
    expect(decoded).not.toHaveProperty('backingFinishMigrated');
    expect(designParams(decoded!).textEdgeFinish).toBe('chamfer');
    expect(designParams(decoded!).edgeFinish).toBe('round');
    expect(designParams(decoded!).topEdgeMm).toBeCloseTo(0.6);
  });

  it('rejects removed backing fields in current v8 payloads', () => {
    expect(decodeDesignDocument(payload({ finish: { ef: 'round' } }, 'v8'))).toBeUndefined();
  });

  it('migrates v9 designs to custom circular openings without changing their dimensions', () => {
    const decoded = decodeDesignDocument(payload({ hardware: { d: 6.2, z: -0.4 } }, 'v9'));
    const params = decoded && designParams(decoded);
    expect(params?.keyringPreset).toBe('custom');
    expect(params?.keyringOpeningShape).toBe('round');
    expect(params?.keyringPosition).toBe('left');
    expect(params?.holeDiameterMm).toBe(6.2);
    expect(params?.ringOffsetMm).toBe(-0.4);
  });

  it('migrates v10 openings to v11 while retaining finish and preset fields', () => {
    const decoded = decodeDesignDocument(
      payload(
        {
          hardware: {
            d: 4,
            kp: 'oval-slot',
            ko: 'slot',
            kl: 8,
            z: 0.3,
          },
          finish: { bf: 'round', bt: 0.2, bb: 0.2 },
        },
        'v10',
      ),
    );
    const params = decoded && designParams(decoded);
    expect(decoded?.version).toBe(11);
    expect(params?.keyringPreset).toBe('oval-slot');
    expect(params?.keyringOpeningShape).toBe('slot');
    expect(params?.keyringPosition).toBe('left');
    expect(params?.ringOffsetMm).toBe(0.3);
    expect(params?.edgeFinish).toBe('round');
    expect(params?.topEdgeMm).toBe(0.2);
    expect(params?.bottomEdgeMm).toBe(0.2);
  });
});
