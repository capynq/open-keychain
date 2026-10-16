import type { KeychainParams } from './types';

export type DependentParameter =
  | 'reliefHaloMm'
  | 'ringOffsetMm'
  | 'jointBossMm'
  | 'keyringSlotLengthMm'
  | 'ribbonNotchMm'
  | 'cornerRadiusMm';

export type ParameterConstraintRange = {
  min: number;
  max: number;
  step: number;
  unit: 'mm' | '°';
};

export const DEPENDENT_PARAMETER_RANGES: Record<DependentParameter, ParameterConstraintRange> = {
  reliefHaloMm: { min: 0, max: 2, step: 0.1, unit: 'mm' },
  ringOffsetMm: { min: -3, max: 3, step: 0.1, unit: 'mm' },
  jointBossMm: { min: 0, max: 3, step: 0.1, unit: 'mm' },
  keyringSlotLengthMm: { min: 3, max: 14, step: 0.5, unit: 'mm' },
  ribbonNotchMm: { min: 1, max: 10, step: 0.5, unit: 'mm' },
  cornerRadiusMm: { min: 1.5, max: 12, step: 0.5, unit: 'mm' },
};

const snappedDown = (value: number, step: number, origin = 0): number =>
  Number((origin + Math.floor((value - origin) / step + 1e-9) * step).toFixed(6));

const snappedUp = (value: number, step: number, origin = 0): number =>
  Number((origin + Math.ceil((value - origin) / step - 1e-9) * step).toFixed(6));

export const dependentParameterRange = <T extends ParameterConstraintRange>(
  params: KeychainParams,
  parameter: DependentParameter,
  range: T,
): T => {
  if (parameter === 'reliefHaloMm')
    return {
      ...range,
      max: snappedDown(Math.min(range.max, Math.max(range.min, params.paddingMm)), range.step),
    };
  if (parameter === 'ringOffsetMm') {
    const limit = snappedDown(Math.max(0.5, Math.min(3, params.textSizeMm * 0.2)), range.step);
    return { ...range, min: -limit, max: limit };
  }
  if (parameter === 'jointBossMm')
    return {
      ...range,
      max: snappedDown(
        Math.min(range.max, Math.max(range.min, params.connectorWidthMm * 0.75)),
        range.step,
      ),
    };
  if (parameter === 'keyringSlotLengthMm')
    return {
      ...range,
      min:
        params.keyringOpeningShape === 'slot'
          ? snappedUp(Math.max(4, params.holeDiameterMm), range.step, range.min)
          : range.min,
    };
  if (parameter === 'ribbonNotchMm' && params.styleId === 'ribbon') {
    const maximum = Math.min(range.max, params.ribbonTailMm * 0.8);
    return {
      ...range,
      max: Math.max(range.min, snappedDown(maximum, range.step, range.min)),
    };
  }
  if (
    parameter === 'cornerRadiusMm' &&
    (params.templateId === 'magnet' || params.styleId === 'ribbon')
  )
    return { ...range, max: Math.min(range.max, 5) };
  return range;
};

const affects = (
  changedKeys: ReadonlySet<keyof KeychainParams>,
  keys: readonly (keyof KeychainParams)[],
) => keys.some((key) => changedKeys.has(key));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Reconcile only dependent values affected by a candidate's changed keys. */
export const reconcileDependentParameterValues = (
  params: KeychainParams,
  changedKeyList: readonly (keyof KeychainParams)[],
): KeychainParams => {
  const changedKeys = new Set(changedKeyList);
  const next = { ...params };
  const range = (parameter: DependentParameter) =>
    dependentParameterRange(params, parameter, DEPENDENT_PARAMETER_RANGES[parameter]);

  if (affects(changedKeys, ['reliefHaloMm', 'paddingMm'])) {
    next.reliefHaloMm = clamp(
      params.reliefHaloMm ?? 0,
      range('reliefHaloMm').min,
      range('reliefHaloMm').max,
    );
  }
  if (affects(changedKeys, ['ringOffsetMm', 'textSizeMm'])) {
    const bounds = range('ringOffsetMm');
    next.ringOffsetMm = clamp(params.ringOffsetMm ?? 0, bounds.min, bounds.max);
  }
  if (affects(changedKeys, ['jointBossMm', 'connectorWidthMm'])) {
    next.jointBossMm = clamp(
      params.jointBossMm ?? 0,
      range('jointBossMm').min,
      range('jointBossMm').max,
    );
  }
  if (
    params.keyringOpeningShape === 'slot' &&
    affects(changedKeys, ['keyringSlotLengthMm', 'holeDiameterMm', 'keyringOpeningShape'])
  ) {
    next.keyringSlotLengthMm = clamp(
      params.keyringSlotLengthMm ?? 8,
      range('keyringSlotLengthMm').min,
      range('keyringSlotLengthMm').max,
    );
  }
  if (
    params.styleId === 'ribbon' &&
    affects(changedKeys, ['ribbonNotchMm', 'ribbonTailMm', 'styleId', 'templateId'])
  ) {
    next.ribbonNotchMm = clamp(
      params.ribbonNotchMm ?? 4,
      range('ribbonNotchMm').min,
      range('ribbonNotchMm').max,
    );
  }
  if (
    (params.templateId === 'magnet' || params.styleId === 'ribbon') &&
    affects(changedKeys, ['cornerRadiusMm', 'templateId', 'styleId'])
  ) {
    next.cornerRadiusMm = clamp(
      params.cornerRadiusMm ?? 4,
      range('cornerRadiusMm').min,
      range('cornerRadiusMm').max,
    );
  }
  return next;
};
