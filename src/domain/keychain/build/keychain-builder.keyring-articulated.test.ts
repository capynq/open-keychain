import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { KEYRING_POSITIONS } from '../model/keyring-position';
import { keyringPresetValues } from '../model/keyring-presets';
import { articulatedKeyringHostIndex, TEMPLATE_CATALOG } from '../templates/template-builder';
import { buildKeychain } from './keychain-builder';
import { DEFAULT_PARAMS, topology, topSurfaceArea, wasm } from './keychain-builder-test-helpers';

describe('keyring and articulated geometry', () => {
  it.each(
    (['name-keychain', 'articulated-name'] as const).flatMap((templateId) =>
      KEYRING_POSITIONS.map((keyringPosition) => ({
        templateId,
        keyringPosition,
        styleId: 'contour' as const,
        text: 'ALEX',
      })),
    ),
  )(
    'builds an oval keyring slot on the $keyringPosition for $templateId',
    async ({ templateId, styleId, text, keyringPosition }) => {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId,
        styleId,
        text,
        fontId: templateId === 'articulated-name' ? 'bungee' : 'nunito',
        keyringPosition,
        keyringPreset: 'oval-slot',
        keyringOpeningShape: 'slot',
        holeDiameterMm: 4,
        keyringSlotLengthMm: 8,
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      const baseTopology = topology(result.baseMesh);
      expect(baseTopology.eulerCharacteristic).toBeLessThan(baseTopology.components * 2);
    },
    30000,
  );

  it.each(['left', 'right', 'top', 'bottom', 'top-left', 'top-right'] as const)(
    'hangs an articulated name from the matching letter on the %s',
    async (keyringPosition) => {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'articulated-name',
        fontId: 'bungee',
        text: 'ALEX',
        keyringPosition,
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      const expectedHost = {
        left: 0,
        'top-left': 0,
        right: 3,
        'top-right': 3,
        top: 1,
        bottom: 1,
      }[keyringPosition];
      expect(result.keyring?.hostIndex).toBe(expectedHost);
      const [x, y] = result.keyring!.centerMm;
      const center = result.dimensions.centerMm;
      if (keyringPosition === 'left' || keyringPosition === 'top-left')
        expect(x).toBeLessThan(center[0] - result.dimensions.widthMm * 0.35);
      if (keyringPosition === 'right' || keyringPosition === 'top-right')
        expect(x).toBeGreaterThan(center[0] + result.dimensions.widthMm * 0.35);
      if (keyringPosition.startsWith('top')) expect(y).toBeGreaterThan(center[1]);
      if (keyringPosition === 'bottom') expect(y).toBeLessThan(center[1]);
    },
    30000,
  );

  it('chooses articulated host letters by chain position and skips empty glyphs', () => {
    const glyph = (width: number, empty = false) => ({
      bounds: { minX: -width / 2, maxX: width / 2, minY: 0, maxY: 10 },
      polygons: empty ? [] : [[[0, 0] as [number, number]]],
    });
    const glyphs = [glyph(10), glyph(4), glyph(10), glyph(10)];
    expect(articulatedKeyringHostIndex(glyphs, 'left')).toBe(0);
    expect(articulatedKeyringHostIndex(glyphs, 'top-right')).toBe(3);
    expect(articulatedKeyringHostIndex(glyphs, 'top')).toBe(2);
    expect(articulatedKeyringHostIndex([glyph(10), glyph(10, true), glyph(10)], 'bottom')).toBe(0);
  });

  it.each(
    TEMPLATE_CATALOG.find((template) => template.id === 'name-keychain')!.styles.flatMap(
      (styleId) => KEYRING_POSITIONS.map((keyringPosition) => ({ styleId, keyringPosition })),
    ),
  )(
    'keeps the $styleId keyring opening clear on the $keyringPosition',
    async ({ styleId, keyringPosition }) => {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        subtitle: styleId === 'heart-split' ? 'SAM' : '',
        keyringPosition,
        ...keyringPresetValues('oval-slot'),
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(result.issues.map((issue) => issue.code)).not.toContain('keyring-opening-blocked');
      expect(result.keyring?.centerMm.every(Number.isFinite)).toBe(true);
    },
    30000,
  );

  it.each([
    { styleId: 'contour', keyringPosition: 'left', ringOffsetMm: -3, text: 'ALEX' },
    { styleId: 'contour', keyringPosition: 'right', ringOffsetMm: 3, text: 'ALEX' },
    { styleId: 'ribbon', keyringPosition: 'top-left', ringOffsetMm: -3, text: 'ALEX' },
    { styleId: 'capsule', keyringPosition: 'top-right', ringOffsetMm: 0, text: 'MAXIMILIAN' },
    { styleId: 'bubble', keyringPosition: 'bottom', ringOffsetMm: 0, text: 'A' },
  ] as const)(
    'pushes a $styleId ring on the $keyringPosition clear of the body ($text, $ringOffsetMm mm)',
    async ({ styleId, keyringPosition, ringOffsetMm, text }) => {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text,
        keyringPosition,
        ringOffsetMm,
        ...keyringPresetValues('large-round'),
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(result.issues.map((issue) => issue.code)).not.toContain('keyring-opening-blocked');
    },
    30000,
  );

  it('mirrors ribbon side rings onto the lower tail tips', async () => {
    const build = (keyringPosition: 'left' | 'right' | 'top-right') =>
      buildKeychain(wasm, { ...DEFAULT_PARAMS, styleId: 'ribbon', text: 'ALEX', keyringPosition });
    const [left, right, topRight] = await Promise.all([
      build('left'),
      build('right'),
      build('top-right'),
    ]);
    expect(left.result.keyring!.centerMm[1]).toBeCloseTo(right.result.keyring!.centerMm[1], 1);
    expect(
      topRight.result.keyring!.centerMm[1] - right.result.keyring!.centerMm[1],
    ).toBeGreaterThan(3);
  }, 30000);

  for (const text of ['NIKITAA', 'IIII', 'ЛІЛІ']) {
    it(`keeps articulated ${text} as separate printable shells`, async () => {
      const { result, exportMesh } = await buildKeychain(
        wasm,
        {
          ...DEFAULT_PARAMS,
          templateId: 'articulated-name',
          fontId: 'rubik',
          text,
        },
        true,
      );
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(result.solidCount).toBe([...text].length * 2 - 1);
      expect(topology(exportMesh!).components).toBe(result.solidCount);
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      expect(exportMesh).toBeDefined();
      expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
    }, 30000);
  }

  for (const font of FONT_CATALOG.filter((item) => item.supportsArticulated)) {
    for (const text of ['ALEX', 'NIKITA', 'IIII']) {
      it(`builds compact articulated ${text} with ${font.name}`, async () => {
        const { result, exportMesh } = await buildKeychain(
          wasm,
          {
            ...DEFAULT_PARAMS,
            templateId: 'articulated-name',
            fontId: font.id,
            text,
          },
          true,
        );
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(result.solidCount).toBe([...text].length * 2 - 1);
        expect(topology(exportMesh!).components).toBe(result.solidCount);
        expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      }, 30000);
    }
  }

  it('uses letter-shaped articulated bodies rather than rectangular plates', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'articulated-name',
      fontId: 'rubik',
      text: 'ALEX',
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    const projected = topSurfaceArea(result.baseMesh);
    expect(projected.surface / projected.hull).toBeLessThan(0.72);
    expect(result.appearance.relief.color).toBe('#D94A52');
    expect(result.appearance.base.color).toBe('#E7E2DA');
  }, 30000);

  it('ignores retained letter spacing for articulated names', async () => {
    const base = {
      ...DEFAULT_PARAMS,
      templateId: 'articulated-name' as const,
      fontId: 'rubik',
      text: 'ALEX',
      letterSpacingMm: 0,
    };
    const zeroSpacing = await buildKeychain(wasm, base);
    const retainedSpacing = await buildKeychain(wasm, { ...base, letterSpacingMm: 8 });
    expect(zeroSpacing.result.printable, JSON.stringify(zeroSpacing.result.issues)).toBe(true);
    expect(retainedSpacing.result.printable, JSON.stringify(retainedSpacing.result.issues)).toBe(
      true,
    );
    expect(retainedSpacing.result.dimensions.widthMm).toBeCloseTo(
      zeroSpacing.result.dimensions.widthMm,
      6,
    );
  }, 30000);

  it('rejects unsupported thin articulated fonts at the builder boundary', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'articulated-name',
      fontId: 'caveat',
      text: 'ALEX',
    });
    expect(result.printable).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'articulated-font', severity: 'error' }),
    );
  }, 30000);
});
