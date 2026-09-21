import { strFromU8, unzipSync } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateMesh } from '@/infrastructure/geometry/manifold-utils';
import { asMesh, manifoldFromMesh } from '@/infrastructure/geometry/manifold-utils';

import { VALIDATION_FIXTURES } from '../../../../scripts/validation-fixtures';
import { serializeThreeMf } from '../../../infrastructure/export/three-mf-serializer';
import { FONT_CATALOG } from '../fonts/catalog';
import { DEFAULT_PARAMS } from '../model/types';
import { buildKeychain, createWasm } from './keychain-builder';

let wasm: Awaited<ReturnType<typeof createWasm>>;
const originalFetch = globalThis.fetch;
beforeAll(async () => {
  globalThis.fetch = (async (input: string | URL) =>
    String(input).startsWith('/fonts/')
      ? new Response(
          Uint8Array.from(await fs.readFile(path.join(process.cwd(), 'public', String(input)))),
        )
      : originalFetch(input)) as typeof fetch;
  wasm = await createWasm();
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('finished geometry contracts', () => {
  it.each(VALIDATION_FIXTURES)(
    'partitions the $id fixture into non-overlapping material solids without changing its model',
    async (fixture) => {
      const built = await buildKeychain(wasm, { ...DEFAULT_PARAMS, ...fixture.params }, true);
      expect(built.result.printable, JSON.stringify(built.result.issues)).toBe(true);
      const base = manifoldFromMesh(wasm, built.result.baseMesh);
      const relief = manifoldFromMesh(wasm, built.result.reliefMesh);
      const overlap = base.intersect(relief);
      const model = base.add(relief);
      const exportSolid = manifoldFromMesh(wasm, built.exportMesh!);
      try {
        // Mesh buffers use Float32 coordinates, so reconstructing their shared
        // boundary can introduce sub-micron signed noise. It must remain
        // negligible relative to the printable model rather than a real overlap.
        expect(Math.abs(overlap.volume()) / Math.abs(model.volume())).toBeLessThan(1e-5);
        const materialBounds = model.boundingBox();
        const exportBounds = exportSolid.boundingBox();
        expect(
          [...materialBounds.min, ...materialBounds.max].every(
            (value, index) =>
              Math.abs(value - [...exportBounds.min, ...exportBounds.max][index]) < 1,
          ),
        ).toBe(true);
        expect(validateMesh(asMesh(model))).toBe(true);
        expect(built.result.validation?.mesh).toBe('passed');
        expect(built.result.validation?.connectivity).not.toBe('separate-parts');
      } finally {
        overlap.delete();
        exportSolid.delete();
        model.delete();
        relief.delete();
        base.delete();
      }
    },
    30000,
  );

  it.each(VALIDATION_FIXTURES)(
    'serializes the $id fixture as one merged object or two named colored material objects',
    async (fixture) => {
      const built = await buildKeychain(wasm, { ...DEFAULT_PARAMS, ...fixture.params }, true);
      const separate = strFromU8(
        unzipSync(
          new Uint8Array(
            serializeThreeMf(
              built.result.baseMesh,
              built.result.reliefMesh,
              built.exportMesh,
              'separate-colors',
              built.result.appearance,
            ),
          ),
        )['3D/3dmodel.model'],
      );
      const merged = strFromU8(
        unzipSync(
          new Uint8Array(
            serializeThreeMf(
              built.result.baseMesh,
              built.result.reliefMesh,
              built.exportMesh,
              'merged',
              built.result.appearance,
            ),
          ),
        )['3D/3dmodel.model'],
      );
      expect(separate.match(/<mesh>/g)).toHaveLength(1);
      expect(separate.match(/<item objectid=/g)).toHaveLength(1);
      expect(separate.match(/<object id=/g)).toHaveLength(1);
      expect(separate).toContain(`name="${built.result.appearance.base.name}"`);
      expect(separate).toContain(`name="${built.result.appearance.relief.name}"`);
      expect(separate).toContain(`displaycolor="${built.result.appearance.base.color}"`);
      expect(separate).toContain(`displaycolor="${built.result.appearance.relief.color}"`);
      expect(separate).toContain('p1="1" p2="1" p3="1"');
      expect(merged.match(/<object id=/g)).toHaveLength(1);
      expect(merged).toContain('name="Keychain"');
    },
    30000,
  );

  it.each(['name-keychain', 'nameplate'] as const)(
    'canonicalizes oversized edge finishes for %s',
    async (templateId) => {
      const params = {
        ...DEFAULT_PARAMS,
        templateId,
        edgeFinish: 'round' as const,
        topEdgeMm: 2,
        bottomEdgeMm: 2,
      };
      const bounded = await buildKeychain(wasm, params);
      expect(bounded.result.edgeFinish).toBeDefined();
      const applied = bounded.result.edgeFinish!;
      expect(applied.topMm + applied.bottomMm).toBeLessThanOrEqual(
        params.baseThicknessMm - params.minimumWallMm,
      );
      const recovered = await buildKeychain(wasm, { ...params, edgeFinish: 'sharp' }, true);
      expect(recovered.result.printable).toBe(true);
      expect(validateMesh(recovered.exportMesh!)).toBe(true);
    },
  );

  it('invalidates parsed fonts when bytes change without an id or revision change', async () => {
    const definition = FONT_CATALOG.find((font) => font.id === 'nunito')!;
    const bytes = async (file: string) =>
      Uint8Array.from(await fs.readFile(path.join(process.cwd(), 'public', file))).buffer;
    const first = { ...definition, data: await bytes('/fonts/nunito.ttf') };
    const second = { ...definition, data: await bytes('/fonts/quicksand.ttf') };
    const params = { ...DEFAULT_PARAMS, text: 'AVATAR', styleId: 'capsule' as const };
    const original = await buildKeychain(wasm, params, false, first);
    const replaced = await buildKeychain(wasm, params, false, second);
    expect(replaced.result.reliefMesh.positions).not.toEqual(original.result.reliefMesh.positions);
    const subtitleParams = { ...params, subtitle: 'AVATAR' };
    const sameFont = await buildKeychain(wasm, subtitleParams, false, first, first);
    const otherFont = await buildKeychain(wasm, subtitleParams, false, first, second);
    expect(otherFont.result.reliefMesh.positions).not.toEqual(sameFont.result.reliefMesh.positions);
  });

  it('blocks disconnected solids and reports the actual solid count', async () => {
    const params = {
      ...DEFAULT_PARAMS,
      fontId: 'comforter',
      text: 'ABCD',
      letterSpacingMm: 8,
      edgeInsetMm: 1.2,
    };
    const blocked = await buildKeychain(wasm, params, true);
    expect(blocked.result.printable).toBe(false);
    expect(blocked.result.solidCount).toBeGreaterThan(1);
    expect(blocked.result.validation?.connectivity).toBe('separate-parts');
    expect(blocked.result.issues).toContainEqual(
      expect.objectContaining({ severity: 'error', code: 'disconnected' }),
    );
    expect(blocked.result.validation?.physical).toBe('unverified');
  });

  it.each(['round', 'chamfer'] as const)(
    'exports an actual %s backing edge, keeping dimensions and a flat bed',
    async (edgeFinish) => {
      const params = { ...DEFAULT_PARAMS, styleId: 'capsule' as const };
      const sharp = await buildKeychain(wasm, params, true);
      const finished = await buildKeychain(wasm, { ...params, edgeFinish, topEdgeMm: 0.3 }, true);
      expect(finished.result.printable, JSON.stringify(finished.result.issues)).toBe(true);
      expect(finished.result.baseMesh.positions).not.toEqual(sharp.result.baseMesh.positions);
      expect(finished.result.dimensions.widthMm).toBeCloseTo(sharp.result.dimensions.widthMm, 2);
      expect(finished.result.dimensions.thicknessMm).toBeCloseTo(
        sharp.result.dimensions.thicknessMm,
        2,
      );
      const zs = finished.result.baseMesh.positions.filter((_, index) => index % 3 === 2);
      expect(Math.min(...zs)).toBeCloseTo(0, 4);
      expect(zs.some((z) => z > 2.1 && z < 2.4)).toBe(true);
      expect(validateMesh(finished.exportMesh!)).toBe(true);
    },
  );

  it('rejects unsupported text edge combinations instead of producing a no-op', async () => {
    const base = {
      ...DEFAULT_PARAMS,
      text: 'O',
      styleId: 'capsule' as const,
      edgeFinish: 'round' as const,
      topEdgeMm: 0.4,
      bottomEdgeMm: 0,
      textEdgeMm: 0,
    };
    const sharpText = await buildKeychain(wasm, base);
    expect(sharpText.result.printable).toBe(true);
    await expect(buildKeychain(wasm, { ...base, textEdgeMm: 0.2 })).rejects.toThrow(/Not manifold/);
  });

  it('rejects malformed triangle buffers consistently', () => {
    expect(
      validateMesh({ positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0]) }),
    ).toBe(false);
    expect(
      validateMesh({ positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 1, 0]) }),
    ).toBe(false);
    expect(
      validateMesh({
        positions: new Float32Array([NaN, 0, 0]),
        indices: new Uint32Array([0, 0, 0]),
      }),
    ).toBe(false);
  });
});
