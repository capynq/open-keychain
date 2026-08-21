import type { KeychainParams, StyleId, TemplateId } from './model/types';

export type RecipeId =
  'clean-contour' | 'bold-capsule' | 'playful-bubble' | 'articulated-motion' | 'garden-marker';
export type DesignRecipe = {
  id: RecipeId;
  fontId: string;
  name: string;
  description: string;
  templateId: TemplateId;
  styleId: StyleId;
  params: Partial<KeychainParams>;
};

/** Curated starting points. Every value is still editable after selection. */
export const DESIGN_RECIPE_CATALOG: readonly DesignRecipe[] = [
  {
    id: 'clean-contour',
    fontId: 'nunito',
    name: 'Classic tag',
    description: 'A clean contour keychain for everyday names.',
    templateId: 'name-keychain',
    styleId: 'contour',
    params: { templateId: 'name-keychain', styleId: 'contour', paddingMm: 2.4 },
  },
  {
    id: 'bold-capsule',
    fontId: 'montserrat',
    name: 'Soft badge',
    description: 'A friendly rounded badge with generous corners.',
    templateId: 'name-keychain',
    styleId: 'capsule',
    params: {
      templateId: 'name-keychain',
      styleId: 'capsule',
      fontWeightMm: 0.8,
      reliefDepthMm: 1.2,
      paddingMm: 2.8,
    },
  },
  {
    id: 'playful-bubble',
    fontId: 'pangolin',
    name: 'Playful bubble',
    description: 'A cheerful bubble shape for short names.',
    templateId: 'name-keychain',
    styleId: 'bubble',
    params: { templateId: 'name-keychain', styleId: 'bubble', cornerRadiusMm: 7 },
  },
  {
    id: 'articulated-motion',
    fontId: 'rubik',
    name: 'Linked letters',
    description: 'Flexible articulated letters with captive joints.',
    templateId: 'articulated-name',
    styleId: 'contour',
    params: {
      templateId: 'articulated-name',
      styleId: 'contour',
      baseThicknessMm: 3.4,
      connectorWidthMm: 2,
      jointClearanceMm: 0.35,
      mechanicalGapMm: 0.6,
    },
  },
  {
    id: 'garden-marker',
    fontId: 'rubik',
    name: 'Garden marker',
    description: 'A practical plant label with a pointed stake.',
    templateId: 'plant-label',
    styleId: 'soft-tag',
    params: {
      templateId: 'plant-label',
      styleId: 'soft-tag',
      stakeLengthMm: 64,
      plantAccentEnabled: true,
    },
  },
];

export const designRecipe = (id: DesignRecipe['id']): DesignRecipe =>
  DESIGN_RECIPE_CATALOG.find((recipe) => recipe.id === id) ?? DESIGN_RECIPE_CATALOG[0];
