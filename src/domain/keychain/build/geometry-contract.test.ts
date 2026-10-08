import { strFromU8, unzipSync } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { validateMesh } from '@/infrastructure/geometry/manifold-utils';
import { asMesh, manifoldFromMesh } from '@/infrastructure/geometry/manifold-utils';

import { VALIDATION_FIXTURES } from '../../../../scripts/geometry/checks/validation-fixtures';
import { serializeThreeMf } from '../../../infrastructure/export/three-mf-serializer';
import { FONT_CATALOG } from '../fonts/catalog';
import { DEFAULT_PARAMS } from '../model/types';
import * as textFinish from './edge-finish';
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
    'serializes the $id fixture as one model with two named colored material volumes',
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
      expect(separate).toContain('p1="1"');
      expect(merged.match(/<object id=/g)).toHaveLength(1);
      expect(merged).toContain('name="Keychain"');
    },
    30000,
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
  }, 30000);

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
    'exports every supported ALEX %s front amount with unchanged lower sections',
    async (textEdgeFinish) => {
      const params = { ...DEFAULT_PARAMS, text: 'ALEX' };
      const sharp = await buildKeychain(wasm, params, true);
      const initial = await buildKeychain(wasm, { ...params, textEdgeFinish, textEdgeMm: 0.2 });
      const maximum =
        textEdgeFinish === 'round'
          ? initial.result.textFinishLimits!.roundMaxMm
          : initial.result.textFinishLimits!.chamferMaxMm;
      expect(maximum).toBe(0.8);
      const sharpRelief = manifoldFromMesh(wasm, sharp.result.reliefMesh);
      const originalLower = sharpRelief.slice((params.baseThicknessMm + 0.1) * 1000);
      try {
        for (const textEdgeMm of [0.2, 0.4, 0.6, 0.8]) {
          const finished = await buildKeychain(
            wasm,
            { ...params, textEdgeFinish, textEdgeMm },
            true,
          );
          expect(finished.result.printable, JSON.stringify(finished.result.issues)).toBe(true);
          expect(finished.result.solidCount).toBe(1);
          expect(validateMesh(finished.exportMesh!)).toBe(true);
          expect(finished.result.dimensions).toEqual(sharp.result.dimensions);
          const relief = manifoldFromMesh(wasm, finished.result.reliefMesh);
          const lower = relief.slice((params.baseThicknessMm + 0.1) * 1000);
          try {
            // Float32 export reconstruction adds sub-micron signed noise, not a changed contour.
            expect(
              Math.abs(lower.area() - originalLower.area()) / originalLower.area(),
            ).toBeLessThan(1e-7);
          } finally {
            lower.delete();
            relief.delete();
          }
          expect(finished.result.edgeFinish).toMatchObject({
            style: 'sharp',
            topMm: 0,
            bottomMm: 0,
          });
        }
      } finally {
        originalLower.delete();
        sharpRelief.delete();
      }
    },
    30000,
  );

  it('rejects externally supplied amounts beyond a thin inscription limit', async () => {
    const params = { ...DEFAULT_PARAMS, fontId: 'marck-script', fontWeightMm: 0, text: 'thin' };
    const sharp = await buildKeychain(wasm, params);
    const limit = sharp.result.textFinishLimits!.roundMaxMm;
    expect(limit).toBeLessThan(0.8);
    await expect(
      buildKeychain(wasm, { ...params, textEdgeFinish: 'round', textEdgeMm: 0.8 }),
    ).rejects.toThrow('too large');
  });

  it.each(['name-keychain', 'articulated-name', 'nameplate', 'plant-label', 'magnet'] as const)(
    'applies a separate text profile to %s',
    async (templateId) => {
      const params = {
        ...DEFAULT_PARAMS,
        templateId,
        ...(templateId === 'articulated-name' ? { fontId: 'rubik' } : {}),
        ...(templateId === 'magnet' ? { baseThicknessMm: 4.6 } : {}),
      };
      const sharp = await buildKeychain(wasm, params);
      const finished = await buildKeychain(wasm, {
        ...params,
        textEdgeFinish: 'chamfer',
        textEdgeMm: 0.2,
      });
      expect(finished.result.printable, JSON.stringify(finished.result.issues)).toBe(true);
      expect(finished.result.reliefMesh.positions).not.toEqual(sharp.result.reliefMesh.positions);
    },
    30000,
  );

  it('recovers from an unsafe articulated finish before building letter bodies', async () => {
    const params = {
      ...DEFAULT_PARAMS,
      templateId: 'articulated-name' as const,
      fontId: 'rubik',
      text: 'ABOO',
    };
    const unsafeLimits = vi
      .spyOn(textFinish, 'textFinishLimits')
      .mockReturnValue({ chamferMaxMm: 0, roundMaxMm: 0 });
    try {
      await expect(
        buildKeychain(wasm, { ...params, textEdgeFinish: 'round', textEdgeMm: 0.2 }),
      ).rejects.toThrow('too large');
    } finally {
      unsafeLimits.mockRestore();
    }
    const recovered = await buildKeychain(
      wasm,
      { ...params, textEdgeFinish: 'round', textEdgeMm: 0.2 },
      true,
    );
    expect(recovered.result.printable, JSON.stringify(recovered.result.issues)).toBe(true);
    expect(validateMesh(recovered.exportMesh!)).toBe(true);
  }, 30000);

  it('keeps finished nameplate counters as voids within one printable body', async () => {
    const built = await buildKeychain(
      wasm,
      {
        ...DEFAULT_PARAMS,
        templateId: 'nameplate',
        text: 'BOO',
        textEdgeFinish: 'round',
        textEdgeMm: 0.2,
      },
      true,
    );
    expect(built.result.printable, JSON.stringify(built.result.issues)).toBe(true);
    const model = manifoldFromMesh(wasm, built.exportMesh!);
    const components = model.decompose();
    try {
      expect(components.filter((component) => component.volume() > 1)).toHaveLength(1);
      expect(model.status()).toBe('NoError');
    } finally {
      components.forEach((component) => component.delete());
      model.delete();
    }
  }, 30000);

  it('keeps a requested size envelope active in the generated dimensions', async () => {
    const params = { ...DEFAULT_PARAMS, sizeEnvelope: { widthMm: 60, heightMm: 25 } };
    const built = await buildKeychain(wasm, params);
    expect(built.result.printable, JSON.stringify(built.result.issues)).toBe(true);
    expect(built.result.dimensions.widthMm).toBeLessThanOrEqual(60.1);
    expect(built.result.dimensions.heightMm).toBeLessThanOrEqual(25.1);
  });

  it.each([
    [40, 20],
    [60, 25],
    [80, 30],
    [100, 35],
    [120, 40],
  ])('fits the default name within the %i × %i mm setup preset', async (widthMm, heightMm) => {
    const built = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      sizeEnvelope: { widthMm, heightMm },
    });
    expect(built.result.printable, JSON.stringify(built.result.issues)).toBe(true);
    expect(built.result.dimensions.widthMm).toBeLessThanOrEqual(widthMm + 0.1);
    expect(built.result.dimensions.heightMm).toBeLessThanOrEqual(heightMm + 0.1);
  });

  it('rejects an envelope smaller than fixed template hardware', async () => {
    const built = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      templateId: 'plant-label',
      sizeEnvelope: { widthMm: 40, heightMm: 20 },
    });
    expect(built.result.printable).toBe(false);
    expect(built.result.issues).toContainEqual(
      expect.objectContaining({ code: 'size-envelope-unavailable', severity: 'error' }),
    );
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
