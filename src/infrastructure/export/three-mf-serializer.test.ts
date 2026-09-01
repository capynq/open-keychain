import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { ARTICULATED_PRINT_APPEARANCE, type MeshBuffer } from '../../domain/keychain/model/types';
import { serializeThreeMf } from './three-mf-serializer';
const triangle: MeshBuffer = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2]),
};
describe('3MF export', () => {
  it('writes separate colored printable parts without viewer geometry', () => {
    const files = unzipSync(new Uint8Array(serializeThreeMf(triangle, triangle, triangle)));
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain('name="Backing"');
    expect(model).toContain('name="Raised text"');
    expect(model).toContain('displaycolor="#B84838"');
    expect(model).toContain('displaycolor="#FAF4E9"');
    expect(model).toContain('pid="10" pindex="0"');
    expect(model).toContain('pid="10" pindex="1"');
    expect(model).not.toContain('<name>');
    expect(model).not.toContain('surface');
  });
  it('supports merged single-object mode', () => {
    const files = unzipSync(
      new Uint8Array(serializeThreeMf(triangle, triangle, triangle, 'merged')),
    );
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model.match(/<object id=/g)).toHaveLength(3);
    expect(model.match(/<item objectid=/g)).toHaveLength(1);
    expect(model).toContain('<object id="1" type="model" name="Keychain"><components>');
    expect(model).toContain('<component objectid="2"/>');
    expect(model).toContain('<component objectid="3"/>');
    expect(model).toContain('displaycolor="#B84838"');
    expect(model).toContain('displaycolor="#FAF4E9"');
    expect(model).toContain('Keychain');
  });
  it('preserves articulated layer names and reference-inspired colours', () => {
    const files = unzipSync(
      new Uint8Array(
        serializeThreeMf(
          triangle,
          triangle,
          triangle,
          'separate-colors',
          ARTICULATED_PRINT_APPEARANCE,
        ),
      ),
    );
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model).toContain('Structural letters and connectors');
    expect(model).toContain('Decorative letter caps');
    expect(model).toContain('displaycolor="#D94A52"');
  });

  it('normalizes valid colors and rejects malformed colors', () => {
    expect(() =>
      serializeThreeMf(triangle, triangle, triangle, 'separate-colors', {
        base: { name: 'Base', color: ' #b84838 ' },
        relief: { name: 'Relief', color: '#faf4e9ff' },
      }),
    ).not.toThrow();

    expect(() =>
      serializeThreeMf(triangle, triangle, triangle, 'separate-colors', {
        base: { name: 'Base', color: 'red' },
        relief: { name: 'Relief', color: '#FAF4E9' },
      }),
    ).toThrow('Invalid 3MF color');
  });
});
