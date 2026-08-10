import type { MeshBuffer } from '../../domain/keychain/model/types';
const writeText = (view: DataView, text: string): void => {
  const bytes = new TextEncoder().encode(text.slice(0, 80));
  for (let i = 0; i < bytes.length; i += 1) view.setUint8(i, bytes[i]);
};
export const serializeBinaryStl = (mesh: MeshBuffer): ArrayBuffer => {
  const triangleCount = mesh.indices.length / 3;
  const data = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(data);
  writeText(view, 'OpenKeychain STL - millimetres');
  view.setUint32(80, triangleCount, true);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = 84 + triangle * 50;
    const i0 = mesh.indices[triangle * 3] * 3;
    const i1 = mesh.indices[triangle * 3 + 1] * 3;
    const i2 = mesh.indices[triangle * 3 + 2] * 3;
    const ax = mesh.positions[i1] - mesh.positions[i0];
    const ay = mesh.positions[i1 + 1] - mesh.positions[i0 + 1];
    const az = mesh.positions[i1 + 2] - mesh.positions[i0 + 2];
    const bx = mesh.positions[i2] - mesh.positions[i0];
    const by = mesh.positions[i2 + 1] - mesh.positions[i0 + 1];
    const bz = mesh.positions[i2 + 2] - mesh.positions[i0 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(offset, nx / length, true);
    view.setFloat32(offset + 4, ny / length, true);
    view.setFloat32(offset + 8, nz / length, true);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const source = mesh.indices[triangle * 3 + vertex] * 3;
      const destination = offset + 12 + vertex * 12;
      view.setFloat32(destination, mesh.positions[source], true);
      view.setFloat32(destination + 4, mesh.positions[source + 1], true);
      view.setFloat32(destination + 8, mesh.positions[source + 2], true);
    }
    view.setUint16(offset + 48, 0, true);
  }
  return data;
};
