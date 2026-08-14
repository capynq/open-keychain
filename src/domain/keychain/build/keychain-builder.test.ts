import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FONT_CATALOG } from '../fonts/catalog';
import { buildKeychain, createWasm } from './keychain-builder';
import { DEFAULT_PARAMS, type KeychainParams, type MeshBuffer } from '../model/types';
const originalFetch = globalThis.fetch;
let wasm: Awaited<ReturnType<typeof createWasm>>;
beforeAll(async () => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.startsWith('/fonts/'))
      return new Response(
        Uint8Array.from(await fs.readFile(path.join(process.cwd(), 'public', url))),
      );
    return originalFetch(input);
  }) as typeof fetch;
  wasm = await createWasm();
}, 30000);
afterAll(() => {
  globalThis.fetch = originalFetch;
});
const topology = (mesh: MeshBuffer) => {
  const vertices = new Set<number>();
  const edges = new Set<string>();
  const adjacency = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    edges.add(left < right ? `${left}:${right}` : `${right}:${left}`);
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    if (!adjacency.has(right)) adjacency.set(right, new Set());
    adjacency.get(left)!.add(right);
    adjacency.get(right)!.add(left);
  };
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = mesh.indices[index];
    const b = mesh.indices[index + 1];
    const c = mesh.indices[index + 2];
    vertices.add(a);
    vertices.add(b);
    vertices.add(c);
    connect(a, b);
    connect(b, c);
    connect(c, a);
  }
  const reached = new Set<number>();
  let components = 0;
  for (const vertex of vertices) {
    if (reached.has(vertex)) continue;
    components += 1;
    const component = [vertex];
    reached.add(vertex);
    while (component.length) {
      const current = component.pop()!;
      adjacency.get(current)?.forEach((neighbor) => {
        if (reached.has(neighbor)) return;
        reached.add(neighbor);
        component.push(neighbor);
      });
    }
  }
  const faces = mesh.indices.length / 3;
  return {
    connected: components === 1,
    components,
    eulerCharacteristic: vertices.size - edges.size + faces,
  };
};
type Point2 = [number, number];
const area = (points: Point2[]): number => {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point[0] * next[1] - next[0] * point[1];
      }, 0),
    ) / 2
  );
};
const convexHull = (points: Point2[]): Point2[] => {
  const unique = [
    ...new Map(
      points.map((point) => [`${point[0].toFixed(4)}:${point[1].toFixed(4)}`, point]),
    ).values(),
  ].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const cross = (origin: Point2, left: Point2, right: Point2) =>
    (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0]);
  const half = (values: Point2[]) => {
    const result: Point2[] = [];
    for (const point of values) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    }
    return result;
  };
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
};
const topSurfaceArea = (
  mesh: MeshBuffer,
): {
  surface: number;
  hull: number;
} => {
  const zValues = Array.from(
    { length: mesh.positions.length / 3 },
    (_, index) => mesh.positions[index * 3 + 2],
  );
  const top = Math.max(...zValues);
  let surface = 0;
  const points: Point2[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const ids = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]];
    if (!ids.every((id) => Math.abs(mesh.positions[id * 3 + 2] - top) < 1e-4)) continue;
    const triangle = ids.map(
      (id) => [mesh.positions[id * 3], mesh.positions[id * 3 + 1]] as Point2,
    );
    surface += area(triangle);
    points.push(...triangle);
  }
  return { surface, hull: area(convexHull(points)) };
};
const meshFingerprint = (mesh: MeshBuffer): number[] => {
  let weightedPositionSum = 0;
  for (let index = 0; index < mesh.positions.length; index += 1)
    weightedPositionSum += mesh.positions[index] * ((index % 17) + 1);
  return [mesh.positions.length, mesh.indices.length, Number(weightedPositionSum.toFixed(3))];
};
const geometryFingerprint = (result: Awaited<ReturnType<typeof buildKeychain>>['result']) => [
  ...meshFingerprint(result.baseMesh),
  ...meshFingerprint(result.reliefMesh),
  Number(result.dimensions.widthMm.toFixed(3)),
  Number(result.dimensions.heightMm.toFixed(3)),
  Number(result.dimensions.thicknessMm.toFixed(3)),
];
describe('finished keychain geometry', () => {
  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
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

  it('keeps all name-keychain styles geometrically distinct', async () => {
    const surfaces: number[] = [];
    for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        letterSpacingMm: 4,
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      surfaces.push(Number(topSurfaceArea(result.baseMesh).surface.toFixed(2)));
    }
    expect(new Set(surfaces)).toHaveLength(6);
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
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'disconnected' }),
    );
    expect(exportMesh).toBeDefined();
    expect(topology(exportMesh!).components).toBeGreaterThan(1);
  }, 30000);
  it('keeps every template/style combination valid across shared shape settings', async () => {
    const styleIds = ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const;
    const combinations = [
      ...styleIds.map((styleId) => ({ templateId: 'name-keychain' as const, styleId })),
      ...styleIds.map((styleId) => ({ templateId: 'plant-label' as const, styleId })),
      { templateId: 'nameplate' as const, styleId: 'contour' as const },
      { templateId: 'articulated-name' as const, styleId: 'contour' as const },
    ];
    const variants = [
      {
        textHeightMm: 12,
        fontWeightMm: 0,
        baseThicknessMm: 1.6,
        reliefDepthMm: 0.6,
        paddingMm: 1.2,
        edgeInsetMm: 1.2,
        letterSpacingMm: 0,
      },
      {
        textHeightMm: 30,
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
        low: { textHeightMm: 12 },
        high: { textHeightMm: 30 },
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
        label: 'backing size',
        base: standard,
        low: { paddingMm: 1.2, edgeInsetMm: 1.2 },
        high: { paddingMm: 4, edgeInsetMm: 4 },
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
        low: { textHeightMm: 12 },
        high: { textHeightMm: 30 },
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
        low: { textHeightMm: 12 },
        high: { textHeightMm: 30 },
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
        label: 'nameplate backing',
        base: nameplate,
        low: { paddingMm: 1.2, edgeInsetMm: 1.2 },
        high: { paddingMm: 4, edgeInsetMm: 4 },
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
        high: { nameplateTiltDeg: 45 },
      },
      {
        label: 'nameplate embed',
        base: nameplate,
        low: { nameplateEmbedMm: 0.2 },
        high: { nameplateEmbedMm: 1.8 },
      },
      { label: 'plant height', base: plant, low: { textHeightMm: 12 }, high: { textHeightMm: 30 } },
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
        label: 'plant backing',
        base: plant,
        low: { paddingMm: 1.2, edgeInsetMm: 1.2 },
        high: { paddingMm: 4, edgeInsetMm: 4 },
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

  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
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
  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
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
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    }, 30000);
  }
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
  it('keeps Frame printable with a recessed text panel', async () => {
    const { result, exportMesh } = await buildKeychain(
      wasm,
      { ...DEFAULT_PARAMS, fontId: 'nunito', styleId: 'frame', text: 'NIKITA' },
      true,
    );
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(exportMesh).toBeDefined();
    expect(topology(exportMesh!).components).toBeGreaterThan(0);
  }, 30000);
  it('keeps Frame printable for a wide name', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'nunito',
      styleId: 'frame',
      text: 'OLIVER',
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
  }, 30000);
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
      nameplateTiltDeg: 45,
      nameplateEmbedMm: 1.8,
      reliefDepthMm: 2,
    });
    expect(low.result.printable, JSON.stringify(low.result.issues)).toBe(true);
    expect(high.result.printable, JSON.stringify(high.result.issues)).toBe(true);
    expect(high.result.dimensions.thicknessMm).toBeGreaterThan(low.result.dimensions.thicknessMm);
  }, 30000);
  it('fits the finished styled geometry and reports the adjustment as a warning', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'bungee',
      styleId: 'bubble',
      text: 'NIKITA',
      textHeightMm: 30,
    });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'scaled-to-fit' }),
    );
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  }, 30000);
  it('returns an actionable error when 12 mm text still cannot fit', async () => {
    const { result } = await buildKeychain(wasm, {
      ...DEFAULT_PARAMS,
      fontId: 'bungee',
      styleId: 'bubble',
      text: 'WWWWWWWWWWWWWWWWWWWWWWWW',
      textHeightMm: 12,
    });
    expect(result.printable).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'error', code: 'text-too-wide' }),
    );
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
  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
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
  for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
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
    for (const styleId of ['contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'frame'] as const) {
      const { result } = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        templateId: 'plant-label',
        styleId,
        text: 'ALEX',
      });
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      surfaces.push(Number(topSurfaceArea(result.baseMesh).surface.toFixed(2)));
    }
    expect(new Set(surfaces)).toHaveLength(6);
  }, 30000);
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
