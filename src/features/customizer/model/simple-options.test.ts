import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS, normalizeParams } from '@/domain/keychain/model/types';

import { finishStrengths } from './finish-strengths';
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

describe('Simple preset recognition after normalization', () => {
  it('keeps every offered backing strength selected on the printer grid', () => {
    for (const maximum of [0.2, 0.4, 0.6, 0.8]) {
      for (const strength of finishStrengths(maximum)) {
        const changes = { topEdgeMm: strength.amountMm, bottomEdgeMm: strength.amountMm };
        const params = normalizeParams({ ...DEFAULT_PARAMS, edgeFinish: 'round', ...changes });
        expect(simpleOptionMatches(params, changes)).toBe(true);
      }
    }
  });

  it('keeps genuinely custom numbers and different nonnumeric values unmatched', () => {
    expect(simpleOptionMatches({ ...DEFAULT_PARAMS, topEdgeMm: 0.61 }, { topEdgeMm: 0.6 })).toBe(
      false,
    );
    expect(
      simpleOptionMatches({ ...DEFAULT_PARAMS, bottomEdgeMm: 0.4 }, { bottomEdgeMm: 0.6 }),
    ).toBe(false);
    expect(simpleOptionMatches(DEFAULT_PARAMS, { edgeFinish: 'round' })).toBe(false);
    expect(simpleOptionMatches({ ...DEFAULT_PARAMS, topEdgeMm: NaN }, { topEdgeMm: 0.6 })).toBe(
      false,
    );
  });
});
