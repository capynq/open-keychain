import { describe, expect, it } from 'vitest';
import { DESIGN_RECIPE_CATALOG } from './recipes';

describe('design recipes', () => {
  it('keeps the curated recipe ids and required mappings stable', () => {
    expect(DESIGN_RECIPE_CATALOG.map((recipe) => recipe.id)).toEqual([
      'clean-contour',
      'bold-capsule',
      'playful-bubble',
      'articulated-motion',
      'garden-marker',
    ]);
    expect(DESIGN_RECIPE_CATALOG.map((recipe) => recipe.fontId)).toEqual([
      'nunito',
      'montserrat',
      'pangolin',
      'rubik',
      'rubik',
    ]);
    for (const recipe of DESIGN_RECIPE_CATALOG) {
      expect(recipe.params.templateId).toBe(recipe.templateId);
      expect(recipe.params.styleId).toBe(recipe.styleId);
      expect(recipe.name).toBeTruthy();
      expect(recipe.description).toBeTruthy();
    }
  });
});
