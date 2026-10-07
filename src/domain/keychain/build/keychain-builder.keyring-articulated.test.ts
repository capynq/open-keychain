import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { KEYRING_POSITIONS } from '../model/keyring-position';
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
