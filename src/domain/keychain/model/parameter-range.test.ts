import { describe, expect, it } from 'vitest';

import { reconcileDependentParameterValues } from './parameter-constraints';
import { parameterRange } from './parameters';
import { DEFAULT_PARAMS } from './types';

describe('parameterRange dynamic bounds', () => {
  it('keeps slot length at least the minimum opening width', () => {
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, keyringOpeningShape: 'slot', holeDiameterMm: 6 },
        'keyringSlotLengthMm',
      ).min,
    ).toBe(6);
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, keyringOpeningShape: 'slot', holeDiameterMm: 3 },
        'keyringSlotLengthMm',
      ).min,
    ).toBe(4);
    const fractionalWidthRange = parameterRange(
      { ...DEFAULT_PARAMS, keyringOpeningShape: 'slot', holeDiameterMm: 4.2 },
      'keyringSlotLengthMm',
    );
    expect(fractionalWidthRange).toMatchObject({ min: 4.5, max: 14 });
    expect((fractionalWidthRange.max - fractionalWidthRange.min) % fractionalWidthRange.step).toBe(
      0,
    );
  });

  it('snaps dependent upper bounds to each control step', () => {
    expect(parameterRange({ ...DEFAULT_PARAMS, paddingMm: 1.25 }, 'reliefHaloMm').max).toBe(1.2);
    expect(parameterRange({ ...DEFAULT_PARAMS, textSizeMm: 12.1 }, 'ringOffsetMm')).toMatchObject({
      min: -2.4,
      max: 2.4,
    });
    expect(parameterRange({ ...DEFAULT_PARAMS, connectorWidthMm: 1.5 }, 'jointBossMm').max).toBe(
      1.1,
    );
  });

  it('limits ribbon notch to a reachable value within the tail geometry', () => {
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'name-keychain', styleId: 'ribbon', ribbonTailMm: 6 },
        'ribbonNotchMm',
      ).max,
    ).toBe(4.5);
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'name-keychain', styleId: 'ribbon', ribbonTailMm: 9 },
        'ribbonNotchMm',
      ).max,
    ).toBe(7);
  });

  it('does not offer corner radii larger than the magnet and ribbon builders use', () => {
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'magnet', styleId: 'plain' },
        'cornerRadiusMm',
      ).max,
    ).toBe(5);
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'name-keychain', styleId: 'ribbon' },
        'cornerRadiusMm',
      ).max,
    ).toBe(5);
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'plant-label', styleId: 'contour' },
        'cornerRadiusMm',
      ).max,
    ).toBe(2);
  });

  it('reconciles only dependent values touched by a candidate change', () => {
    const params = {
      ...DEFAULT_PARAMS,
      templateId: 'magnet' as const,
      styleId: 'plain' as const,
      cornerRadiusMm: 8,
      reliefHaloMm: 1.5,
      paddingMm: 1.2,
    };
    expect(reconcileDependentParameterValues(params, ['templateId'])).toMatchObject({
      cornerRadiusMm: 5,
      reliefHaloMm: 1.5,
    });
    expect(reconcileDependentParameterValues(params, ['text'])).toMatchObject({
      cornerRadiusMm: 8,
      reliefHaloMm: 1.5,
    });
    expect(
      reconcileDependentParameterValues({ ...params, reliefHaloMm: 1.5 }, ['paddingMm'])
        .reliefHaloMm,
    ).toBe(1.2);
  });

  it('raises a slot length when its width grows', () => {
    const params = {
      ...DEFAULT_PARAMS,
      keyringOpeningShape: 'slot' as const,
      holeDiameterMm: 6,
      keyringSlotLengthMm: 5,
    };
    expect(reconcileDependentParameterValues(params, ['holeDiameterMm']).keyringSlotLengthMm).toBe(
      6,
    );
    expect(
      reconcileDependentParameterValues(
        { ...params, holeDiameterMm: 4.2, keyringSlotLengthMm: 4.2 },
        ['holeDiameterMm'],
      ).keyringSlotLengthMm,
    ).toBe(4.5);
  });
});
