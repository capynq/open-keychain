import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS } from '@/domain/keychain/model/types';

import { reconcileGeometryParameterLimits } from './geometry-parameter-limits';

describe('measured parameter bounds', () => {
  it('preserves valid or unmeasured candidates without a second build', () => {
    expect(reconcileGeometryParameterLimits(DEFAULT_PARAMS, undefined)).toBe(DEFAULT_PARAMS);
    expect(reconcileGeometryParameterLimits(DEFAULT_PARAMS, { cornerRadiusMm: 12 })).toBe(
      DEFAULT_PARAMS,
    );
  });

  it('snaps actual nameplate radius down and preserves unrelated values', () => {
    const params = { ...DEFAULT_PARAMS, templateId: 'nameplate' as const, cornerRadiusMm: 9.5 };
    const result = reconcileGeometryParameterLimits(params, { cornerRadiusMm: 8.15 });
    expect(result).toEqual({ ...params, cornerRadiusMm: 8 });
    expect(params.cornerRadiusMm).toBe(9.5);
  });

  it('allows zero shoulder when the foundation already reaches maximum stake width', () => {
    const params = { ...DEFAULT_PARAMS, templateId: 'plant-label' as const, stakeShoulderMm: 8 };
    expect(reconcileGeometryParameterLimits(params, { stakeShoulderMm: 0 }).stakeShoulderMm).toBe(
      0,
    );
  });
});
