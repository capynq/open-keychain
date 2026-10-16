import type { GeometryParameterLimits, KeychainParams } from '@/domain/keychain/model/types';

import { parameterRange } from '@/domain/keychain/model/parameters';

/** Apply measured bounds only to an edit candidate; loading a saved design stays unchanged. */
export const reconcileGeometryParameterLimits = (
  params: KeychainParams,
  limits: GeometryParameterLimits | undefined,
): KeychainParams => {
  let result = params;
  for (const key of ['cornerRadiusMm', 'stakeShoulderMm'] as const) {
    const maximum = limits?.[key];
    if (maximum === undefined || !Number.isFinite(maximum) || params[key] <= maximum + 1e-8)
      continue;
    const range = parameterRange(params, key);
    const value = Math.max(range.min, Math.floor((maximum + 1e-8) / range.step) * range.step);
    if (value !== params[key]) result = { ...result, [key]: value };
  }
  return result;
};
