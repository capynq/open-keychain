import { describe, expect, it } from 'vitest';

import { canonicalEdgeMm, normalizeEdgeFinish } from './edge-finish';
import { DEFAULT_PARAMS, normalizeParams } from './types';

describe('edge finish contract', () => {
  it('snaps values to the printer grid and safely handles invalid values', () => {
    expect(canonicalEdgeMm(0.31, 2)).toBe(0.4);
    expect(canonicalEdgeMm(Number.NaN, 2)).toBe(0);
    expect(canonicalEdgeMm(Number.POSITIVE_INFINITY, 2)).toBe(0);
    expect(canonicalEdgeMm(-1, 2)).toBe(0);
  });

  it('canonicalizes legacy and template-specific combinations', () => {
    const base = { ...DEFAULT_PARAMS, textEdgeFinish: 'round' as const, textEdgeMm: 0.8 };
    const normalized = normalizeParams(base);
    expect(normalized.textEdgeMm).toBe(0.8);
    expect(
      normalizeParams({
        ...base,
        textEdgeFinish: 'round',
        textEdgeMm: 0.2,
      }).textEdgeMm,
    ).toBe(0.2);
    expect(
      normalizeParams({
        ...base,
        templateId: 'nameplate',
        textEdgeFinish: 'chamfer',
        textEdgeMm: 0.4,
      }).textEdgeMm,
    ).toBe(0.4);
  });

  it('leaves a 0.2 mm relief cap below a text finish', () => {
    const finish = normalizeEdgeFinish({
      ...DEFAULT_PARAMS,
      textEdgeFinish: 'round',
      reliefDepthMm: 1,
      textEdgeMm: 1,
    });
    expect(finish.textMm).toBe(0.8);
  });
});
