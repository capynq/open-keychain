import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS, normalizeParams } from '@/domain/keychain/model/types';

import { simpleOptionGroups, simpleOptionMatches } from './simple-options';

describe('Simple default presets', () => {
  it('recognizes the initial backing thickness as Balanced', () => {
    const params = normalizeParams({ ...DEFAULT_PARAMS });
    const thickness = simpleOptionGroups(params).find((group) => group.id === 'baseThicknessMm');
    const selected = thickness?.choices.find((choice) =>
      simpleOptionMatches(params, choice.changes),
    );
    expect(selected?.labelKey).toBe('simpleBaseThicknessBalanced');
  });

  it('recognizes the default coupled Heart size and border', () => {
    const params = normalizeParams({ ...DEFAULT_PARAMS, styleId: 'heart-split' });
    const heart = simpleOptionGroups(params).find((group) => group.id === 'heart-layout');
    const selected = heart?.choices.find((choice) => simpleOptionMatches(params, choice.changes));
    expect(selected?.labelKey).toBe('simpleHeartLayoutBalanced');
  });
});
