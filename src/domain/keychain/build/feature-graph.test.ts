import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ModelFeature } from '../model/model-feature';

import { manifoldFromMesh, validateMesh } from '../../../infrastructure/geometry/manifold-utils';
import { DEFAULT_PARAMS, type KeychainParams } from '../model/types';
import { applyFeatureGraph } from './feature-graph';
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

const largeProfile: [number, number][][] = [
  [
    [-100, -100],
    [100, -100],
    [100, 100],
    [-100, 100],
  ],
];
const revolveProfile: [number, number][][] = [
  [
    [0.2, -100],
    [100, -100],
    [100, 100],
    [0.2, 100],
  ],
];
const features: ModelFeature[] = [
  {
    id: 'box',
    kind: 'box',
    operation: 'intersect',
    sizeMm: [200, 200, 20],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
  },
  {
    id: 'sphere',
    kind: 'sphere',
    operation: 'intersect',
    sizeMm: [200, 200, 20],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
  },
  {
    id: 'cylinder',
    kind: 'cylinder',
    operation: 'intersect',
    sizeMm: [200, 200, 20],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
  },
  {
    id: 'extrude',
    kind: 'extrude',
    operation: 'intersect',
    sizeMm: [1, 1, 20],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    polygons: largeProfile,
  },
  {
    id: 'revolve',
    kind: 'revolve',
    operation: 'intersect',
    sizeMm: [1, 1, 20],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    polygons: revolveProfile,
  },
  {
    id: 'sweep',
    kind: 'sweep',
    operation: 'intersect',
    sizeMm: [1, 1, 1],
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    polygons: largeProfile,
    pathMm: [
      [0, 0, -10],
      [0, 0, 10],
    ],
  },
];

describe('feature graph', () => {
  it.each(features)('evaluates the $kind node with real Manifold geometry', async (feature) => {
    const params = {
      ...DEFAULT_PARAMS,
      modelFeatures: [feature],
    } satisfies KeychainParams;
    const original = await buildKeychain(wasm, { ...DEFAULT_PARAMS }, false);
    const output = applyFeatureGraph(wasm, original.result, params, true);
    expect(
      output.result.issues.filter((issue) => issue.severity === 'error'),
      JSON.stringify(output.result.issues),
    ).toEqual([]);
    expect(Number.isFinite(output.result.dimensions.widthMm)).toBe(true);
    expect(Number.isFinite(output.result.dimensions.heightMm)).toBe(true);
    expect(Number.isFinite(output.result.dimensions.thicknessMm)).toBe(true);
    expect(validateMesh(output.result.baseMesh)).toBe(true);
    expect(validateMesh(output.result.reliefMesh)).toBe(true);
    expect(validateMesh(output.exportMesh!)).toBe(true);
    const base = manifoldFromMesh(wasm, output.result.baseMesh);
    const relief = manifoldFromMesh(wasm, output.result.reliefMesh);
    const overlap = base.intersect(relief);
    const model = base.add(relief);
    try {
      expect(Math.abs(overlap.volume()) / Math.abs(model.volume())).toBeLessThan(1e-6);
    } finally {
      overlap.delete();
      model.delete();
      relief.delete();
      base.delete();
    }
  });

  it.each(['articulated-name', 'nameplate'] as const)(
    'rejects unsupported %s templates without replacing geometry',
    async (templateId) => {
      const original = await buildKeychain(wasm, { ...DEFAULT_PARAMS, templateId }, false);
      const output = applyFeatureGraph(
        wasm,
        original.result,
        { ...DEFAULT_PARAMS, templateId, modelFeatures: [features[0]] },
        true,
      );
      expect(output.exportMesh).toBeUndefined();
      expect(output.result.printable).toBe(false);
      expect(
        output.result.issues.some((issue) => issue.code === 'feature-unsupported-template'),
      ).toBe(true);
      expect(output.result.baseMesh.positions).toEqual(original.result.baseMesh.positions);
    },
  );

  it('keeps finite dimensions when a feature removes the complete model', async () => {
    const original = await buildKeychain(wasm, { ...DEFAULT_PARAMS }, false);
    const output = applyFeatureGraph(
      wasm,
      original.result,
      {
        ...DEFAULT_PARAMS,
        modelFeatures: [
          { ...features[0], id: 'empty', operation: 'subtract', sizeMm: [200, 200, 200] },
        ],
      },
      false,
    );
    expect(output.result.printable).toBe(false);
    expect(output.result.issues.some((issue) => issue.code === 'feature-geometry')).toBe(true);
    expect(
      Object.values(output.result.dimensions)
        .flat()
        .every((value) => Number.isFinite(value)),
    ).toBe(true);
  });
});
