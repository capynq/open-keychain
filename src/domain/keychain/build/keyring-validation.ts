import type { CrossSection, Manifold } from '../../../infrastructure/geometry/manifold-types';
import type { ValidationIssue } from '../model/types';

import { MANIFOLD_SCALE, sectionArea } from '../../../infrastructure/geometry/manifold-utils';

/**
 * Material allowed inside the keyring opening, in scaled square units. Boolean seams leave a few
 * square microns; anything near 0.05 mm² narrows the opening a printer would actually see.
 */
const OPENING_TOLERANCE_AREA = 0.05 * MANIFOLD_SCALE * MANIFOLD_SCALE;

export const keyringOpeningBlockedIssue = (): ValidationIssue => ({
  severity: 'error',
  code: 'keyring-opening-blocked',
  message:
    'The keyring opening is covered by the design at this position. Choose another keyring position or offset.',
});

/** Area of the opening covered by any of the given flat material layers. */
export const blockedOpeningArea = (
  opening: CrossSection,
  layers: readonly (CrossSection | undefined)[],
): number =>
  layers.reduce((total, layer) => {
    if (!layer) return total;
    const covered = opening.intersect(layer);
    try {
      return total + sectionArea(covered);
    } finally {
      covered.delete();
    }
  }, 0);

export const isOpeningClear = (
  opening: CrossSection,
  layers: readonly (CrossSection | undefined)[],
): boolean => blockedOpeningArea(opening, layers) <= OPENING_TOLERANCE_AREA;

/** True when no solid reaches into the opening extruded through the full model height. */
export const isOpeningClearOfSolids = (
  opening: CrossSection,
  solids: readonly Manifold[],
  bounds: { min: number[]; max: number[] },
): boolean => {
  const height = bounds.max[2] - bounds.min[2] + 2 * MANIFOLD_SCALE;
  const column = opening.extrude(height).translate([0, 0, bounds.min[2] - MANIFOLD_SCALE]);
  try {
    const toleranceVolume = OPENING_TOLERANCE_AREA * MANIFOLD_SCALE;
    return solids.every((solid) => {
      const covered = solid.intersect(column);
      try {
        return covered.volume() <= toleranceVolume;
      } finally {
        covered.delete();
      }
    });
  } finally {
    column.delete();
  }
};
