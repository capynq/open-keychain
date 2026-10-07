import { describe, expect, it } from 'vitest';

import { type KeychainParams } from '../model/types';
import { buildKeychain } from './keychain-builder';
import {
  DEFAULT_PARAMS,
  geometryFingerprint,
  topology,
  topSurfaceArea,
  wasm,
} from './keychain-builder-test-helpers';

describe('geometry contracts', () => {
  it('preserves the established default Name-keychain contour baseline', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'name-keychain',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'ALEX',
      paddingMm: 2.4,
      edgeInsetMm: 2.4,
      reliefHaloMm: 0,
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.widthMm).toBeCloseTo(78.84, 2);
    expect(result.dimensions.heightMm).toBeCloseTo(25.995, 2);
    expect(result.dimensions.thicknessMm).toBeCloseTo(3.4, 2);
  }, 30000);

  it('keeps all name-keychain styles geometrically distinct', async () => {
    const surfaces: number[] = [];
    for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        letterSpacingMm: 4,
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      surfaces.push(Number(topSurfaceArea(result.baseMesh).surface.toFixed(2)));
    }
    expect(new Set(surfaces)).toHaveLength(5);
  }, 30000);

  it('keeps widely spaced letters separate instead of adding automatic bridges', async () => {
    const { result, exportMesh } = await buildKeychain(
      wasm,
      {
        ...DEFAULT_PARAMS,
        fontId: 'comforter',
        styleId: 'contour',
        text: 'ABCD',
        letterSpacingMm: 8,
        edgeInsetMm: 1.2,
      },
      true,
    );
    expect(result.printable, JSON.stringify(result.issues)).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'error', code: 'disconnected' }),
    );
    expect(exportMesh).toBeDefined();
    expect(topology(exportMesh!).components).toBeGreaterThan(1);
  }, 30000);

  it('keeps every template/style combination valid across shared shape settings', async () => {
    const styleIds = ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const;
    const combinations = [
      ...styleIds.map((styleId) => ({ templateId: 'name-keychain' as const, styleId })),
      ...styleIds.map((styleId) => ({ templateId: 'plant-label' as const, styleId })),
      { templateId: 'nameplate' as const, styleId: 'contour' as const },
      { templateId: 'articulated-name' as const, styleId: 'contour' as const },
    ];
    const variants = [
      {
        textSizeMm: 12,
        fontWeightMm: 0,
        baseThicknessMm: 1.6,
        reliefDepthMm: 0.6,
        paddingMm: 1.2,
        edgeInsetMm: 1.2,
        letterSpacingMm: 0,
      },
      {
        textSizeMm: 30,
        fontWeightMm: 1.5,
        baseThicknessMm: 4,
        reliefDepthMm: 2,
        paddingMm: 4,
        edgeInsetMm: 4,
        letterSpacingMm: 8,
      },
    ];
    for (const combination of combinations)
      for (const variant of variants) {
        const { result, exportMesh } = await buildKeychain(
          wasm,
          {
            ...DEFAULT_PARAMS,
            ...combination,
            ...variant,
            fontId: combination.templateId === 'articulated-name' ? 'rubik' : 'nunito',
            text: 'ALEX',
            baseThicknessMm:
              combination.templateId === 'articulated-name'
                ? Math.max(3.4, variant.baseThicknessMm)
                : variant.baseThicknessMm,
          },
          true,
        );
        expect(
          result.printable,
          `${combination.templateId}/${combination.styleId}: ${JSON.stringify(result.issues)}`,
        ).toBe(true);
        expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
        expect(exportMesh).toBeDefined();
        expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
      }
  }, 90000);

  it('builds the heart-split backing as two printable halves', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'name-keychain',
      styleId: 'heart-split',
      text: 'LOVE',
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.widthMm).toBeGreaterThan(36);
    expect(result.dimensions.heightMm).toBeGreaterThan(20);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  }, 30000);

  it('changes the mesh for every exposed shape control at its safe limits', async () => {
    type ControlCase = {
      label: string;
      base: Partial<KeychainParams>;
      low: Partial<KeychainParams>;
      high: Partial<KeychainParams>;
    };
    const standard: Partial<KeychainParams> = {
      templateId: 'name-keychain',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'ALEX',
    };
    const articulated: Partial<KeychainParams> = {
      templateId: 'articulated-name',
      fontId: 'rubik',
      text: 'ALEX',
      baseThicknessMm: 3.4,
    };
    const nameplate: Partial<KeychainParams> = {
      templateId: 'nameplate',
      fontId: 'nunito',
      text: 'ALEX',
    };
    const plant: Partial<KeychainParams> = {
      templateId: 'plant-label',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'ALEX',
    };
    const cases: ControlCase[] = [
      {
        label: 'name height',
        base: standard,
        low: { textSizeMm: 12 },
        high: { textSizeMm: 30 },
      },
      {
        label: 'font weight',
        base: standard,
        low: { fontWeightMm: 0 },
        high: { fontWeightMm: 1.5 },
      },
      {
        label: 'base thickness',
        base: standard,
        low: { baseThicknessMm: 1.6 },
        high: { baseThicknessMm: 4 },
      },
      {
        label: 'relief depth',
        base: standard,
        low: { reliefDepthMm: 0.6 },
        high: { reliefDepthMm: 2 },
      },
      {
        label: 'border padding',
        base: standard,
        low: { paddingMm: 1.2 },
        high: { paddingMm: 4 },
      },
      {
        label: 'text edge inset',
        base: standard,
        low: { edgeInsetMm: 1.2 },
        high: { edgeInsetMm: 4 },
      },
      {
        label: 'letter spacing',
        base: standard,
        low: { letterSpacingMm: 0 },
        high: { letterSpacingMm: 8 },
      },
      {
        label: 'keyring hole',
        base: standard,
        low: { holeDiameterMm: 3 },
        high: { holeDiameterMm: 7 },
      },
      {
        label: 'articulated name height',
        base: articulated,
        low: { textSizeMm: 12 },
        high: { textSizeMm: 30 },
      },
      {
        label: 'articulated base',
        base: articulated,
        low: { baseThicknessMm: 3.4 },
        high: { baseThicknessMm: 4 },
      },
      {
        label: 'articulated relief',
        base: articulated,
        low: { reliefDepthMm: 0.6 },
        high: { reliefDepthMm: 2 },
      },
      {
        label: 'articulated hole',
        base: articulated,
        low: { holeDiameterMm: 3 },
        high: { holeDiameterMm: 7 },
      },
      {
        label: 'connector width',
        base: articulated,
        low: { connectorWidthMm: 1.4 },
        high: { connectorWidthMm: 3 },
      },
      {
        label: 'joint clearance',
        base: articulated,
        low: { jointClearanceMm: 0.2 },
        high: { jointClearanceMm: 0.6 },
      },
      {
        label: 'mechanical gap',
        base: articulated,
        low: { mechanicalGapMm: 0.4 },
        high: { mechanicalGapMm: 1.5 },
      },
      {
        label: 'maximum joint angle',
        base: articulated,
        low: { maxJointAngleDeg: 15 },
        high: { maxJointAngleDeg: 50 },
      },
      {
        label: 'nameplate height',
        base: nameplate,
        low: { textSizeMm: 12 },
        high: { textSizeMm: 30 },
      },
      {
        label: 'nameplate weight',
        base: nameplate,
        low: { fontWeightMm: 0 },
        high: { fontWeightMm: 1.5 },
      },
      {
        label: 'nameplate base',
        base: nameplate,
        low: { baseThicknessMm: 1.6 },
        high: { baseThicknessMm: 4 },
      },
      {
        label: 'nameplate relief',
        base: nameplate,
        low: { reliefDepthMm: 0.6 },
        high: { reliefDepthMm: 2 },
      },
      {
        label: 'nameplate border padding',
        base: nameplate,
        low: { paddingMm: 1.2 },
        high: { paddingMm: 4 },
      },
      {
        label: 'nameplate text edge inset',
        base: nameplate,
        low: { edgeInsetMm: 1.2 },
        high: { edgeInsetMm: 4 },
      },
      {
        label: 'nameplate radius',
        base: nameplate,
        low: { cornerRadiusMm: 1.5 },
        high: { cornerRadiusMm: 6 },
      },
      {
        label: 'nameplate tilt',
        base: nameplate,
        low: { nameplateTiltDeg: 0 },
        high: { nameplateTiltDeg: 90 },
      },
      {
        label: 'nameplate embed',
        base: nameplate,
        low: { nameplateEmbedMm: 0.2 },
        high: { nameplateEmbedMm: 1.8 },
      },
      { label: 'plant height', base: plant, low: { textSizeMm: 12 }, high: { textSizeMm: 30 } },
      { label: 'plant weight', base: plant, low: { fontWeightMm: 0 }, high: { fontWeightMm: 1.5 } },
      {
        label: 'plant base',
        base: plant,
        low: { baseThicknessMm: 1.6 },
        high: { baseThicknessMm: 4 },
      },
      {
        label: 'plant relief',
        base: plant,
        low: { reliefDepthMm: 0.6 },
        high: { reliefDepthMm: 2 },
      },
      {
        label: 'plant border padding',
        base: plant,
        low: { paddingMm: 1.2 },
        high: { paddingMm: 4 },
      },
      {
        label: 'plant text edge inset',
        base: plant,
        low: { edgeInsetMm: 1.2 },
        high: { edgeInsetMm: 4 },
      },
      {
        label: 'plant letter spacing',
        base: plant,
        low: { letterSpacingMm: 0 },
        high: { letterSpacingMm: 8 },
      },
      {
        label: 'plant corner radius',
        base: plant,
        low: { cornerRadiusMm: 1.5 },
        high: { cornerRadiusMm: 2 },
      },
      {
        label: 'stake length',
        base: plant,
        low: { stakeLengthMm: 24 },
        high: { stakeLengthMm: 100 },
      },
    ];
    for (const control of cases) {
      const low = await buildKeychain(wasm, { ...DEFAULT_PARAMS, ...control.base, ...control.low });
      const high = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        ...control.base,
        ...control.high,
      });
      expect(low.result.printable, `${control.label}: ${JSON.stringify(low.result.issues)}`).toBe(
        true,
      );
      expect(high.result.printable, `${control.label}: ${JSON.stringify(high.result.issues)}`).toBe(
        true,
      );
      expect(geometryFingerprint(high.result), control.label).not.toEqual(
        geometryFingerprint(low.result),
      );
    }
  }, 90000);

  it('fits the finished styled geometry and reports the adjustment as a warning', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'bungee',
      styleId: 'bubble',
      text: 'NIKITA',
      textSizeMm: 30,
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'scaled-to-fit' }),
    );
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  }, 30000);

  it('keeps an oversized 12 mm text exportable with a warning', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'bungee',
      styleId: 'bubble',
      text: 'WWWWWWWWWWWWWWWWWWWWWWWW',
      textSizeMm: 12,
    });
    expect(result.printable).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'text-over-width' }),
    );
  }, 30000);
});
