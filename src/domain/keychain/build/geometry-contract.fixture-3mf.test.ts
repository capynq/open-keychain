import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { VALIDATION_FIXTURES } from '../../../../scripts/geometry/checks/validation-fixtures';
import { serializeThreeMf } from '../../../infrastructure/export/three-mf-serializer';
import { buildKeychain } from './keychain-builder';
import { DEFAULT_PARAMS, wasm } from './keychain-builder-test-helpers';

// Split out of geometry-contract.test.ts: Vitest runs files in parallel but the
// tests inside one file serially, and the fixture sweep dominated that file.
describe('finished geometry contracts', () => {
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
});
