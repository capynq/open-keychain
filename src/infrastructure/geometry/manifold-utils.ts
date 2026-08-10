import type { CrossSection, DisposableGeometry, Manifold } from './manifold-types';
import type { MeshBuffer } from '../../domain/keychain/model/types';

export const MANIFOLD_SCALE = 1000;

export const asMesh = (manifold: Manifold): MeshBuffer => {
  const mesh = manifold.getMesh();
  const positions = new Float32Array(mesh.numVert * 3);
  for (let vertex = 0; vertex < mesh.numVert; vertex += 1) {
    const source = mesh.position(vertex);
    positions[vertex * 3] = source[0] / MANIFOLD_SCALE;
    positions[vertex * 3 + 1] = source[1] / MANIFOLD_SCALE;
    positions[vertex * 3 + 2] = source[2] / MANIFOLD_SCALE;
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
};

export const mergeMeshes = (meshes: MeshBuffer[]): MeshBuffer => {
  const positions = new Float32Array(meshes.reduce((sum, mesh) => sum + mesh.positions.length, 0));
  const indices = new Uint32Array(meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0));
  let positionOffset = 0;
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const mesh of meshes) {
    positions.set(mesh.positions, positionOffset);
    for (let index = 0; index < mesh.indices.length; index += 1)
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    positionOffset += mesh.positions.length;
    vertexOffset += mesh.positions.length / 3;
    indexOffset += mesh.indices.length;
  }
  return { positions, indices };
};

export const disposeGeometry = (items: readonly DisposableGeometry[]): void => {
  items.forEach((item) => {
    try {
      item.delete();
    } catch (error) {
      void error;
    }
  });
};

export const validateMesh = (mesh: MeshBuffer): boolean => {
  return [...mesh.positions].every(Number.isFinite) && [...mesh.indices].every(Number.isFinite);
};

export const finiteBounds = (bounds: {
  min: readonly number[];
  max: readonly number[];
}): boolean => {
  return [...bounds.min, ...bounds.max].every(Number.isFinite);
};

export const sectionArea = (section: CrossSection): number => {
  const polygonArea = (polygon: Array<[number, number]>): number =>
    polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2;
  return Math.abs(
    section
      .toPolygons()
      .reduce((area, polygon) => area + polygonArea(polygon as Array<[number, number]>), 0),
  );
};
