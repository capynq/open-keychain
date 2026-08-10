import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { serializeThreeMf } from './three-mf-serializer';
import { ARTICULATED_PRINT_APPEARANCE, type MeshBuffer } from '../../domain/keychain/model/types';
const triangle: MeshBuffer = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2]),
};
describe('3MF export', () => {
  it('writes separate colored printable parts without viewer geometry', () => {
    const files = unzipSync(new Uint8Array(serializeThreeMf(triangle, triangle, triangle)));
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain('Backing');
    expect(model).toContain('Raised text');
    expect(model).toContain('displaycolor="#B84838"');
    expect(model).not.toContain('surface');
  });
  it('supports merged single-object mode', () => {
    const files = unzipSync(new Uint8Array(serializeThreeMf(triangle, triangle, triangle, 'merged')));
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model.match(/<object id=/g)).toHaveLength(1);
    expect(model).toContain('Keychain');
  });
  it('preserves articulated layer names and reference-inspired colours', () => {
    const files = unzipSync(
      new Uint8Array(serializeThreeMf(triangle, triangle, triangle, 'separate-colors', ARTICULATED_PRINT_APPEARANCE)),
    );
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('Structural letters and connectors');
    expect(model).toContain('Decorative letter caps');
    expect(model).toContain('displaycolor="#D94A52"');
  });
});
