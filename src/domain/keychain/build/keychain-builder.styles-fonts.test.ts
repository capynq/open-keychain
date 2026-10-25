import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { type KeychainParams } from '../model/types';
import { buildKeychain } from './keychain-builder';
import {
  DEFAULT_PARAMS,
  geometryFingerprint,
  meshFingerprint,
  topology,
  topSurfaceArea,
  wasm,
} from './keychain-builder-test-helpers';

describe('styles and fonts', () => {
  it('supports independent subtitle styling across standard templates', async () => {
    for (const templateId of ['name-keychain', 'magnet', 'nameplate', 'plant-label'] as const) {
      const base: KeychainParams = {
        ...DEFAULT_PARAMS,
        templateId,
        styleId: templateId === 'magnet' ? 'plain' : 'contour',
        baseThicknessMm: templateId === 'magnet' ? 4.4 : DEFAULT_PARAMS.baseThicknessMm,
        text: 'NAME',
        subtitle: 'ROLE',
        subtitleFontId: 'caveat',
        subtitleTextSizeMm: 6,
        subtitleReliefDepthMm: 0.6,
        subtitleOffsetXRatio: 0,
        subtitleOffsetYRatio: 0,
      };
      const first = await buildKeychain(wasm, base);
      const second = await buildKeychain(wasm, {
        ...base,
        subtitleTextSizeMm: 9,
        subtitleReliefDepthMm: 1.4,
        subtitleOffsetXRatio: 0.5,
      });
      expect(first.result.printable, `${templateId}: ${JSON.stringify(first.result.issues)}`).toBe(
        true,
      );
      expect(
        second.result.printable,
        `${templateId}: ${JSON.stringify(second.result.issues)}`,
      ).toBe(true);
      expect(geometryFingerprint(second.result)).not.toEqual(geometryFingerprint(first.result));
    }
  }, 120000);

  it('includes subtitles in Nameplate and Plant label relief geometry', async () => {
    for (const templateId of ['nameplate', 'plant-label'] as const) {
      const withoutSubtitle = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId,
        styleId: templateId === 'nameplate' ? 'contour' : 'arch',
        text: 'NAME',
        subtitle: '',
      });
      const withSubtitle = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId,
        styleId: templateId === 'nameplate' ? 'contour' : 'arch',
        text: 'NAME',
        subtitle: 'ROLE',
      });
      expect(withSubtitle.result.printable, JSON.stringify(withSubtitle.result.issues)).toBe(true);
      expect(meshFingerprint(withSubtitle.result.reliefMesh)).not.toEqual(
        meshFingerprint(withoutSubtitle.result.reliefMesh),
      );
    }
  }, 60000);

  it('keeps an Arch subtitle on the same curve as the primary relief', async () => {
    const straight = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'arch',
      text: 'ALEX',
      subtitle: 'ROLE',
      archCurveMm: 0,
    });
    const curved = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'arch',
      text: 'ALEX',
      subtitle: 'ROLE',
      archCurveMm: 6,
    });
    expect(straight.result.printable, JSON.stringify(straight.result.issues)).toBe(true);
    expect(curved.result.printable, JSON.stringify(curved.result.issues)).toBe(true);
    expect(meshFingerprint(curved.result.reliefMesh)).not.toEqual(
      meshFingerprint(straight.result.reliefMesh),
    );
  }, 30000);

  it('makes relief halo visible around both Arch text lines', async () => {
    const withoutHalo = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'arch',
      text: 'ALEX',
      subtitle: 'ROLE',
      reliefHaloMm: 0,
    });
    const withHalo = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'arch',
      text: 'ALEX',
      subtitle: 'ROLE',
      reliefHaloMm: 2,
    });
    expect(withoutHalo.result.printable, JSON.stringify(withoutHalo.result.issues)).toBe(true);
    expect(withHalo.result.printable, JSON.stringify(withHalo.result.issues)).toBe(true);
    expect(meshFingerprint(withHalo.result.baseMesh)).not.toEqual(
      meshFingerprint(withoutHalo.result.baseMesh),
    );
  }, 30000);

  it('brings similarly sized Contour title lines into a natural join', async () => {
    const joined = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'contour',
      text: 'ALEX',
      subtitle: 'qwerty',
      subtitleTextSizeMm: DEFAULT_PARAMS.textSizeMm,
      subtitleGapMm: 1.5,
    });
    const separated = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      styleId: 'contour',
      text: 'ALEX',
      subtitle: 'qwerty',
      subtitleTextSizeMm: DEFAULT_PARAMS.textSizeMm,
      subtitleGapMm: 8,
    });
    expect(joined.result.printable, JSON.stringify(joined.result.issues)).toBe(true);
    expect(separated.result.printable, JSON.stringify(separated.result.issues)).toBe(true);
    expect(joined.result.dimensions.heightMm).toBeLessThan(separated.result.dimensions.heightMm);
  }, 30000);

  it('builds a printable magnet with a contained subtitle and ribbon variation', async () => {
    const compact = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'ribbon',
      baseThicknessMm: 4.4,
      textSizeMm: 12,
      text: 'EVENT',
      subtitle: '2026',
      ribbonTailMm: 6,
      ribbonNotchMm: 1,
    });
    const spacious = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'ribbon',
      baseThicknessMm: 5,
      textSizeMm: 12,
      text: 'EVENT',
      subtitle: '2026',
      ribbonTailMm: 18,
      ribbonNotchMm: 8,
    });
    expect(compact.result.printable).toBe(true);
    expect(compact.result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(
      false,
    );
    expect(spacious.result.printable, JSON.stringify(spacious.result.issues)).toBe(true);
    expect(geometryFingerprint(spacious.result)).not.toEqual(geometryFingerprint(compact.result));
    expect(compact.result.dimensions.thicknessMm).toBeGreaterThanOrEqual(4.4);
  });

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
    it(`changes ${styleId} geometry across the full backing-size range`, async () => {
      const compact = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        paddingMm: 1.2,
        edgeInsetMm: 1.2,
      });
      const spacious = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        paddingMm: 4,
        edgeInsetMm: 4,
      });
      expect(compact.result.printable, JSON.stringify(compact.result.issues)).toBe(true);
      expect(spacious.result.printable, JSON.stringify(spacious.result.issues)).toBe(true);
      expect(topSurfaceArea(spacious.result.baseMesh).surface).toBeGreaterThan(
        topSurfaceArea(compact.result.baseMesh).surface,
      );
    }, 30000);
  }

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
    for (const font of FONT_CATALOG) {
      it(`contains Latin relief for ${font.name} ${styleId}`, async () => {
        const { result } = await buildKeychain(wasm, {
          ...DEFAULT_PARAMS,
          fontId: font.id,
          styleId,
          text: 'ALEX',
        });
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(false);
        expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      }, 30000);
    }
  }

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
    for (const font of FONT_CATALOG.filter((font) => font.scripts.includes('cyrillic'))) {
      it(`contains Cyrillic relief for ${font.name} ${styleId}`, async () => {
        const { result } = await buildKeychain(wasm, {
          ...DEFAULT_PARAMS,
          fontId: font.id,
          styleId,
          text: 'НИКИТА',
        });
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(false);
      }, 30000);
    }
  }

  for (const fontId of [
    'nunito',
    'oswald',
    'caveat',
    'marck-script',
    'bad-script',
    'neucha',
    'amatic-sc',
    'lobster',
    'pangolin',
  ]) {
    it(`builds Cyrillic НИКИТА with ${fontId}`, async () => {
      const { result, exportMesh } = await buildKeychain(
        wasm,
        { ...DEFAULT_PARAMS, fontId, styleId: 'contour', text: 'НИКИТА' },
        true,
      );
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(exportMesh).toBeDefined();
      expect(topology(exportMesh!).components).toBeGreaterThan(0);
      if (
        FONT_CATALOG.find((font) => font.id === fontId)?.minimumFittedTextHeightMm &&
        result.dimensions.widthMm > 120.1
      ) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({ severity: 'warning', code: 'text-over-width' }),
        );
      } else {
        expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      }
    }, 30000);
  }

  it('applies the print-safe minimum weight to Cyrillic calligraphic text', async () => {
    const automatic = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'comforter-brush',
      text: 'ВЛАДИСЛАВА',
      fontWeightMm: 0,
    });
    const explicit = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'comforter-brush',
      text: 'ВЛАДИСЛАВА',
      fontWeightMm: 0.4,
    });
    expect(automatic.result.printable, JSON.stringify(automatic.result.issues)).toBe(true);
    expect(explicit.result.printable, JSON.stringify(explicit.result.issues)).toBe(true);
    expect(geometryFingerprint(automatic.result)).toEqual(geometryFingerprint(explicit.result));
  }, 60000);

  it('keeps calligraphic text readable instead of shrinking it to the width cap', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'comforter-brush',
      text: 'ВЛАДИСЛАВА',
      textSizeMm: 20,
      fontWeightMm: 0,
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.heightMm).toBeGreaterThanOrEqual(20);
    expect(result.dimensions.widthMm).toBeGreaterThan(120);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'text-over-width' }),
    );
    expect(result.issues.some((issue) => issue.code === 'scaled-to-fit')).toBe(false);
  }, 30000);

  for (const text of ['NIKITA', 'NIKITAA', 'IIIIIIII']) {
    it(`keeps Bungee Bubble ${text} manifold with an open ring`, async () => {
      const { result, exportMesh } = await buildKeychain(
        wasm,
        { ...DEFAULT_PARAMS, fontId: 'bungee', styleId: 'bubble', text },
        true,
      );
      expect(exportMesh).toBeDefined();
      expect(
        result.printable,
        JSON.stringify({
          issues: result.issues,
          base: topology(result.baseMesh),
          model: topology(exportMesh!),
        }),
      ).toBe(true);
      expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      const meshTopology = topology(exportMesh!);
      expect(meshTopology.components).toBeGreaterThan(0);
      expect(meshTopology.eulerCharacteristic).toBeLessThanOrEqual(0);
      const triangles = exportMesh!.indices.length / 3;
      expect(triangles <= 12000 || result.issues.some((issue) => issue.code === 'dense-mesh')).toBe(
        true,
      );
    }, 30000);
  }

  it('keeps the NIKITA Bubble silhouette materially below its convex hull area', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'bungee',
      styleId: 'bubble',
      text: 'NIKITA',
    });
    const projected = topSurfaceArea(result.baseMesh);
    expect(projected.surface / projected.hull).toBeLessThan(0.9);
  }, 30000);
});
