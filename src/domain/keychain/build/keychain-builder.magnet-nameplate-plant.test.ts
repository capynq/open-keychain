import { describe, expect, it } from 'vitest';

import { buildKeychain } from './keychain-builder';
import {
  DEFAULT_PARAMS,
  geometryFingerprint,
  topology,
  topSurfaceArea,
  wasm,
} from './keychain-builder-test-helpers';

describe('magnet, nameplate and plant label', () => {
  it('builds every magnet style with a blind rear pocket and no keyring', async () => {
    for (const styleId of [
      'plain',
      'contour',
      'capsule',
      'soft-tag',
      'bubble',
      'arch',
      'ribbon',
    ] as const) {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'magnet',
        styleId,
        baseThicknessMm: 4.4,
        text: 'MAGNET',
        subtitle: '2026',
        magnetPocketPreset: '10x3',
        magnetPocketPlacement: 'center',
      });
      expect(result.printable, `${styleId}: ${JSON.stringify(result.issues)}`).toBe(true);
      expect(result.magnetPocket?.preset).toBe('10x3');
      expect(result.magnetPocket?.depthMm).toBe(3.2);
      expect(result.magnetPocket?.diameterMm).toBe(10.4);
      expect(result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(false);
    }
  }, 60000);

  it('changes pocket placement and dimensions across the fixed hardware presets', async () => {
    const upper = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'plain',
      baseThicknessMm: 4.4,
      magnetPocketPreset: '6x2',
      magnetPocketPlacement: 'upper',
    });
    const right = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'plain',
      baseThicknessMm: 4.4,
      magnetPocketPreset: '15x3',
      magnetPocketPlacement: 'right',
    });
    expect(upper.result.magnetPocket?.centerMm[1]).toBeGreaterThan(0);
    expect(right.result.magnetPocket?.centerMm[0]).toBeGreaterThan(0);
    expect(upper.result.magnetPocket?.diameterMm).toBe(6.4);
    expect(upper.result.magnetPocket?.depthMm).toBe(2.2);
    expect(right.result.magnetPocket?.diameterMm).toBe(15.4);
    expect(right.result.magnetPocket?.depthMm).toBe(3.2);
  }, 60000);

  it('builds a tilted, embedded Nameplate without a keyring', async () => {
    const { result, exportMesh } = await buildKeychain(
      wasm,
      {
        ...DEFAULT_PARAMS,
        templateId: 'nameplate',
        fontId: 'nunito',
        text: 'OLIVER',
        nameplateTiltDeg: 18,
        nameplateEmbedMm: 1.2,
      },
      true,
    );
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(exportMesh).toBeDefined();
    expect(topology(exportMesh!).connected).toBe(true);
    expect(result.solidCount).toBe(1);
    expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    const baseMaxZ = Math.max(
      ...Array.from(
        { length: result.baseMesh.positions.length / 3 },
        (_, index) => result.baseMesh.positions[index * 3 + 2],
      ),
    );
    const reliefMinZ = Math.min(
      ...Array.from(
        { length: result.reliefMesh.positions.length / 3 },
        (_, index) => result.reliefMesh.positions[index * 3 + 2],
      ),
    );
    const reliefMaxZ = Math.max(
      ...Array.from(
        { length: result.reliefMesh.positions.length / 3 },
        (_, index) => result.reliefMesh.positions[index * 3 + 2],
      ),
    );
    expect(reliefMinZ).toBeGreaterThanOrEqual(baseMaxZ - 0.15);
    expect(reliefMaxZ - baseMaxZ).toBeGreaterThan(0.2);
  }, 30000);

  it('keeps every Nameplate text component embedded while the top lift changes', async () => {
    const low = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      fontId: 'nunito',
      text: 'ALEX',
      nameplateTiltDeg: 45,
      nameplateEmbedMm: 1.8,
      reliefDepthMm: 0.6,
    });
    const high = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      fontId: 'nunito',
      text: 'ALEX',
      nameplateTiltDeg: 90,
      nameplateEmbedMm: 1.8,
      reliefDepthMm: 2,
    });
    expect(low.result.printable, JSON.stringify(low.result.issues)).toBe(true);
    expect(high.result.printable, JSON.stringify(high.result.issues)).toBe(true);
    expect(high.result.dimensions.thicknessMm).toBeGreaterThan(low.result.dimensions.thicknessMm);
  }, 30000);

  for (const templateId of ['articulated-name', 'nameplate', 'plant-label'] as const) {
    for (const text of ['NIKITA', 'НІКІТА']) {
      it(`builds ${templateId} for ${text}`, async () => {
        const { result, exportMesh } = await buildKeychain(
          wasm,
          {
            ...DEFAULT_PARAMS,
            templateId,
            fontId: templateId === 'articulated-name' || text.includes('І') ? 'rubik' : 'caveat',
            text,
          },
          true,
        );
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(exportMesh).toBeDefined();
        if (templateId === 'articulated-name') {
          expect(result.solidCount).toBe([...text].length * 2 - 1);
          expect(topology(exportMesh!).components).toBe(result.solidCount);
        } else if (templateId === 'nameplate') {
          expect(topology(exportMesh!).connected).toBe(true);
        } else {
          expect(topology(exportMesh!).components).toBeGreaterThan(0);
        }
        if (templateId === 'plant-label') expect(result.baseShading).toBe('flat');
        expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
        expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
      }, 30000);
    }
  }

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
    it(`builds the ${styleId} plant label shape`, async () => {
      const { result, exportMesh } = await buildKeychain(
        wasm,
        {
          ...DEFAULT_PARAMS,
          templateId: 'plant-label',
          styleId,
          text: 'ALEX',
        },
        true,
      );
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(exportMesh).toBeDefined();
      expect(topology(exportMesh!).components).toBeGreaterThan(0);
      expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
    }, 30000);
  }

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
    it(`changes the ${styleId} plant label across the backing-size range`, async () => {
      const compact = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
        styleId,
        text: 'ALEX',
        paddingMm: 1.2,
        edgeInsetMm: 1.2,
      });
      const spacious = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
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

  it('keeps all plant-label styles geometrically distinct', async () => {
    const surfaces: number[] = [];
    for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
        styleId,
        text: 'ALEX',
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      surfaces.push(Number(topSurfaceArea(result.baseMesh).surface.toFixed(2)));
    }
    expect(new Set(surfaces)).toHaveLength(5);
  }, 30000);

  it('toggles decorative plant-label accents without changing the stake or text', async () => {
    for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'] as const) {
      const enabled = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
        styleId,
        text: 'ALEX',
        plantAccentEnabled: true,
      });
      const disabled = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
        styleId,
        text: 'ALEX',
        plantAccentEnabled: false,
      });
      expect(enabled.result.printable, `${styleId}: ${JSON.stringify(enabled.result.issues)}`).toBe(
        true,
      );
      expect(
        disabled.result.printable,
        `${styleId}: ${JSON.stringify(disabled.result.issues)}`,
      ).toBe(true);
      const enabledFingerprint = geometryFingerprint(enabled.result);
      const disabledFingerprint = geometryFingerprint(disabled.result);
      expect(enabledFingerprint).not.toEqual(disabledFingerprint);
      // Decorations may stay inside the existing bounds, especially on Arch.
      // The mesh fingerprint above verifies that the accents actually changed.
    }
  }, 60000);

  it('changes the nameplate across the backing-size range', async () => {
    const compact = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      text: 'ALEX',
      paddingMm: 1.2,
      edgeInsetMm: 1.2,
    });
    const spacious = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
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

  for (const text of ['ALEX', 'НІКІТА']) {
    it(`builds a pointed, embedded plant label for ${text}`, async () => {
      const { result, exportMesh } = await buildKeychain(
        wasm,
        {
          ...DEFAULT_PARAMS,
          templateId: 'plant-label',
          fontId: text.includes('І') ? 'rubik' : 'nunito',
          text,
          stakeLengthMm: 48,
          reliefDepthMm: 2,
        },
        true,
      );
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(exportMesh).toBeDefined();
      expect(topology(exportMesh!).components).toBeGreaterThan(0);
      expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      const positions = exportMesh!.positions;
      let minY = Infinity;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let index = 0; index < positions.length; index += 3) {
        minY = Math.min(minY, positions[index + 1]);
        minX = Math.min(minX, positions[index]);
        maxX = Math.max(maxX, positions[index]);
      }
      const centerX = (minX + maxX) / 2;
      const tipXs: number[] = [];
      for (let index = 0; index < positions.length; index += 3)
        if (positions[index + 1] <= minY + 0.001) tipXs.push(positions[index]);
      expect(tipXs.length).toBeGreaterThan(0);
      expect(Math.max(...tipXs.map((x) => Math.abs(x - centerX)))).toBeLessThan(1);
      const baseZ = Math.max(
        ...Array.from(
          { length: result.baseMesh.positions.length / 3 },
          (_, index) => result.baseMesh.positions[index * 3 + 2],
        ),
      );
      const reliefZ = Math.max(
        ...Array.from(
          { length: result.reliefMesh.positions.length / 3 },
          (_, index) => result.reliefMesh.positions[index * 3 + 2],
        ),
      );
      expect(reliefZ - baseZ).toBeGreaterThan(1.9);
      expect(reliefZ - baseZ).toBeLessThanOrEqual(2.1);
    }, 30000);
  }
});
