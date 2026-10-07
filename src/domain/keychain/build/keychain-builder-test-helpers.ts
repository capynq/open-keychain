import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';

import type { buildKeychain } from './keychain-builder';

import { DEFAULT_PARAMS as PRODUCT_DEFAULTS, type MeshBuffer } from '../model/types';
import { createWasm } from './keychain-builder';
const originalFetch = globalThis.fetch;
// These fixtures exercise mesh validity, including intentionally separate pieces.
// Connected-product export is covered independently in geometry-contract.test.ts.
export const DEFAULT_PARAMS = { ...PRODUCT_DEFAULTS };
export let wasm: Awaited<ReturnType<typeof createWasm>>;
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
export const topology = (mesh: MeshBuffer) => {
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
export type Point2 = [number, number];
export const area = (points: Point2[]): number => {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point[0] * next[1] - next[0] * point[1];
      }, 0),
    ) / 2
  );
};
export const convexHull = (points: Point2[]): Point2[] => {
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
export const topSurfaceArea = (
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
export const meshFingerprint = (mesh: MeshBuffer): number[] => {
  let weightedPositionSum = 0;
  for (let index = 0; index < mesh.positions.length; index += 1)
    weightedPositionSum += mesh.positions[index] * ((index % 17) + 1);
  return [mesh.positions.length, mesh.indices.length, Number(weightedPositionSum.toFixed(3))];
};
export const geometryFingerprint = (
  result: Awaited<ReturnType<typeof buildKeychain>>['result'],
) => [
  ...meshFingerprint(result.baseMesh),
  ...meshFingerprint(result.reliefMesh),
  Number(result.dimensions.widthMm.toFixed(3)),
  Number(result.dimensions.heightMm.toFixed(3)),
  Number(result.dimensions.thicknessMm.toFixed(3)),
];
