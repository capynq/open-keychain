/// <reference types="node" />
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildKeychain, createWasm } from './builder';
import { DEFAULT_PARAMS, type MeshBuffer } from './types';

const originalFetch = globalThis.fetch;
let wasm: Awaited<ReturnType<typeof createWasm>>;

beforeAll(async () => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.startsWith('/fonts/')) return new Response(Uint8Array.from(await fs.readFile(path.join(process.cwd(), 'public', url))));
    return originalFetch(input);
  }) as typeof fetch;
  wasm = await createWasm();
}, 30_000);

afterAll(() => { globalThis.fetch = originalFetch; });

function topology(mesh: MeshBuffer) {
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
    vertices.add(a); vertices.add(b); vertices.add(c);
    connect(a, b); connect(b, c); connect(c, a);
  }
  const pending = vertices.size ? [vertices.values().next().value as number] : [];
  const reached = new Set<number>();
  while (pending.length) {
    const vertex = pending.pop()!;
    if (reached.has(vertex)) continue;
    reached.add(vertex);
    adjacency.get(vertex)?.forEach((neighbor) => pending.push(neighbor));
  }
  const faces = mesh.indices.length / 3;
  return { connected: reached.size === vertices.size, eulerCharacteristic: vertices.size - edges.size + faces };
}

type Point2 = [number, number];

function area(points: Point2[]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function convexHull(points: Point2[]): Point2[] {
  const unique = [...new Map(points.map((point) => [`${point[0].toFixed(4)}:${point[1].toFixed(4)}`, point])).values()]
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const cross = (origin: Point2, left: Point2, right: Point2) => (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0]);
  const half = (values: Point2[]) => {
    const result: Point2[] = [];
    for (const point of values) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    }
    return result;
  };
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
}

function topSurfaceArea(mesh: MeshBuffer): { surface: number; hull: number } {
  const zValues = Array.from({ length: mesh.positions.length / 3 }, (_, index) => mesh.positions[index * 3 + 2]);
  const top = Math.max(...zValues);
  let surface = 0;
  const points: Point2[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const ids = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]];
    if (!ids.every((id) => Math.abs(mesh.positions[id * 3 + 2] - top) < 1e-4)) continue;
    const triangle = ids.map((id) => [mesh.positions[id * 3], mesh.positions[id * 3 + 1]] as Point2);
    surface += area(triangle);
    points.push(...triangle);
  }
  return { surface, hull: area(convexHull(points)) };
}

describe('finished keychain geometry', () => {
  for (const fontId of ['nunito', 'oswald', 'caveat', 'marck-script', 'bad-script', 'neucha', 'amatic-sc', 'lobster', 'pangolin']) {
    it(`builds Cyrillic НИКИТА with ${fontId}`, async () => {
      const { result, exportMesh } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId, styleId: 'contour', text: 'НИКИТА' }, true);
      expect(result.printable, JSON.stringify(result.issues)).toBe(true);
      expect(exportMesh).toBeDefined();
      expect(topology(exportMesh!).connected).toBe(true);
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    }, 30_000);
  }

  for (const text of ['NIKITA', 'NIKITAA', 'IIIIIIII']) {
    it(`keeps Bungee Bubble ${text} manifold with an open ring`, async () => {
      const { result, exportMesh } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'bungee', styleId: 'bubble', text }, true);
      expect(exportMesh).toBeDefined();
      expect(result.printable, JSON.stringify({ issues: result.issues, base: topology(result.baseMesh), model: topology(exportMesh!) })).toBe(true);
      expect([...exportMesh!.positions].every(Number.isFinite)).toBe(true);
      expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      const meshTopology = topology(exportMesh!);
      expect(meshTopology.connected).toBe(true);
      expect(meshTopology.eulerCharacteristic).toBeLessThanOrEqual(0);
      const triangles = exportMesh!.indices.length / 3;
      expect(triangles <= 12_000 || result.issues.some((issue) => issue.code === 'dense-mesh')).toBe(true);
    }, 30_000);
  }

  it('keeps the NIKITA Bubble silhouette materially below its convex hull area', async () => {
    const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'bungee', styleId: 'bubble', text: 'NIKITA' });
    const projected = topSurfaceArea(result.baseMesh);
    expect(projected.surface / projected.hull).toBeLessThan(0.9);
  }, 30_000);

  it('keeps Frame printable with a recessed text panel', async () => {
    const { result, exportMesh } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'nunito', styleId: 'frame', text: 'NIKITA' }, true);
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(exportMesh).toBeDefined();
    expect(topology(exportMesh!).connected).toBe(true);
  }, 30_000);

  it('keeps Frame printable for a wide name', async () => {
    const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'nunito', styleId: 'frame', text: 'OLIVER' });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
  }, 30_000);

  it('fits the finished styled geometry and reports the adjustment as a warning', async () => {
    const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'bungee', styleId: 'bubble', text: 'NIKITA', textHeightMm: 30 });
    expect(result.printable, JSON.stringify(result.issues)).toBe(true);
    expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: 'warning', code: 'scaled-to-fit' }));
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  }, 30_000);

  it('returns an actionable error when 12 mm text still cannot fit', async () => {
    const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, fontId: 'bungee', styleId: 'bubble', text: 'WWWWWWWWWWWWWWWWWWWWWWWW', textHeightMm: 12 });
    expect(result.printable).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: 'error', code: 'text-too-wide' }));
  }, 30_000);
});
