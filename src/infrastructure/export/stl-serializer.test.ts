import { describe, expect, it } from 'vitest';

import { serializeBinaryStl } from './stl-serializer';
describe('binary STL export', () => {
  it('writes a valid single-triangle binary STL', () => {
    const data = serializeBinaryStl({
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
      indices: new Uint32Array([0, 1, 2]),
    });
    const view = new DataView(data);
    expect(data.byteLength).toBe(134);
    expect(new TextDecoder().decode(new Uint8Array(data, 0, 23))).toContain('OpenKeychain STL');
    expect(view.getUint32(80, true)).toBe(1);
    expect(view.getFloat32(108, true)).toBe(10);
  });
});
