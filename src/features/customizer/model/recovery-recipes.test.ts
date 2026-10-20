import { describe, expect, it } from 'vitest';

import { fontDefinition } from '../../../domain/keychain/fonts/catalog';
import { DEFAULT_PARAMS } from '../../../domain/keychain/model/types';
import { recoveryRecipes } from './recovery-recipes';

describe('recovery recipes', () => {
  it('offers a measured smaller text edge and sharp fallback while preserving design inputs', () => {
    const params = {
      ...DEFAULT_PARAMS,
      text: 'ЖАННА',
      textSizeMm: 22,
      textEdgeFinish: 'round' as const,
      textEdgeMm: 0.6,
      sizeEnvelope: { widthMm: 90, heightMm: 35 },
      keyringPreset: 'standard-round' as const,
      keyringPosition: 'right' as const,
    };
    const recipes = recoveryRecipes(
      params,
      {
        code: 'text-edge-too-large',
        context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.6 },
      },
      fontDefinition(params.fontId),
    );
    expect(recipes.map((recipe) => recipe.id)).toEqual(['smaller-edge', 'sharp-edge']);
    expect(recipes[0].params.textEdgeMm).toBe(0.2);
    expect(recipes[1].params.textEdgeFinish).toBe('sharp');
    expect(recipes[1].params.textEdgeMm).toBe(0);
    expect(recipes[0].params).toMatchObject({
      text: params.text,
      textSizeMm: params.textSizeMm,
      sizeEnvelope: params.sizeEnvelope,
      keyringPreset: params.keyringPreset,
      keyringPosition: params.keyringPosition,
    });
  });

  it('does not guess a smaller amount when no measured maximum exists', () => {
    const recipes = recoveryRecipes(
      { ...DEFAULT_PARAMS, textEdgeFinish: 'round', textEdgeMm: 0.6 },
      { code: 'text-edge-too-large' },
      fontDefinition(DEFAULT_PARAMS.fontId),
    );
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe('sharp-edge');
  });

  it('creates only smaller catalog size presets', () => {
    const recipes = recoveryRecipes(
      { ...DEFAULT_PARAMS, textSizeMm: 30 },
      { code: 'text-too-wide' },
      fontDefinition(DEFAULT_PARAMS.fontId),
    );
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes.every((recipe) => Number(recipe.values?.size) < 30)).toBe(true);
    expect(recipes.every((recipe) => recipe.params.textSizeMm === recipe.values?.size)).toBe(true);
  });
});
