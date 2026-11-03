import { describe, expect, it } from 'vitest';

import { validateMesh } from '@/infrastructure/geometry/manifold-utils';
import { asMesh, manifoldFromMesh } from '@/infrastructure/geometry/manifold-utils';

import { VALIDATION_FIXTURES } from '../../../../scripts/geometry/checks/validation-fixtures';
import { buildKeychain } from './keychain-builder';
import { DEFAULT_PARAMS, wasm } from './keychain-builder-test-helpers';

// Split out of geometry-contract.test.ts: Vitest runs files in parallel but the
// tests inside one file serially, and the fixture sweep dominated that file.
describe('finished geometry contracts', () => {
  it.each(VALIDATION_FIXTURES)(
    'partitions the $id fixture into non-overlapping material solids without changing its model',
    async (fixture) => {
      const built = await buildKeychain(wasm, { ...DEFAULT_PARAMS, ...fixture.params }, true);
      expect(built.result.printable, JSON.stringify(built.result.issues)).toBe(true);
      const base = manifoldFromMesh(wasm, built.result.baseMesh);
      const relief = manifoldFromMesh(wasm, built.result.reliefMesh);
      const overlap = base.intersect(relief);
      const model = base.add(relief);
      const exportSolid = manifoldFromMesh(wasm, built.exportMesh!);
      try {
        // Mesh buffers use Float32 coordinates, so reconstructing their shared
        // boundary can introduce sub-micron signed noise. It must remain
        // negligible relative to the printable model rather than a real overlap.
        expect(Math.abs(overlap.volume()) / Math.abs(model.volume())).toBeLessThan(1e-5);
        const materialBounds = model.boundingBox();
        const exportBounds = exportSolid.boundingBox();
        expect(
          [...materialBounds.min, ...materialBounds.max].every(
            (value, index) =>
              Math.abs(value - [...exportBounds.min, ...exportBounds.max][index]) < 1,
          ),
        ).toBe(true);
        expect(validateMesh(asMesh(model))).toBe(true);
        expect(built.result.validation?.mesh).toBe('passed');
        expect(built.result.validation?.connectivity).not.toBe('separate-parts');
      } finally {
        overlap.delete();
        exportSolid.delete();
        model.delete();
        relief.delete();
        base.delete();
      }
    },
    30000,
  );
});
