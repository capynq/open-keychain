import type { KeychainParams, StyleId, TemplateId } from './types';
export type ParameterRange = {
  min: number;
  max: number;
  step: number;
  unit: 'mm' | '°';
};
export type ParameterDefinition = ParameterRange & {
  labelKey: string;
  dependencies: readonly ShapeParameter[];
  randomization: 'uniform' | 'boolean' | 'derived';
};
export type ShapeParameter =
  | 'textSizeMm'
  | 'fontWeightMm'
  | 'baseThicknessMm'
  | 'reliefDepthMm'
  | 'paddingMm'
  | 'edgeInsetMm'
  | 'letterSpacingMm'
  | 'holeDiameterMm'
  | 'connectorWidthMm'
  | 'jointClearanceMm'
  | 'mechanicalGapMm'
  | 'maxJointAngleDeg'
  | 'cornerRadiusMm'
  | 'stakeLengthMm'
  | 'nameplateTiltDeg'
  | 'nameplateEmbedMm'
  | 'reliefHaloMm'
  | 'ringOffsetMm'
  | 'bubbleLobeMm'
  | 'tagTailMm'
  | 'archCurveMm'
  | 'stakeShoulderMm'
  | 'jointBossMm';
export type CustomizerParameter = ShapeParameter | 'plantAccentEnabled';
export const PARAMETER_RANGES = {
  textSizeMm: { min: 12, max: 30, step: 0.5, unit: 'mm' },
  fontWeightMm: { min: 0, max: 1.5, step: 0.1, unit: 'mm' },
  baseThicknessMm: { min: 1.6, max: 4, step: 0.1, unit: 'mm' },
  reliefDepthMm: { min: 0.6, max: 2, step: 0.1, unit: 'mm' },
  paddingMm: { min: 1.2, max: 5, step: 0.1, unit: 'mm' },
  edgeInsetMm: { min: 0.8, max: 4, step: 0.1, unit: 'mm' },
  letterSpacingMm: { min: 0, max: 8, step: 0.1, unit: 'mm' },
  holeDiameterMm: { min: 3, max: 7, step: 0.1, unit: 'mm' },
  connectorWidthMm: { min: 1.4, max: 3, step: 0.1, unit: 'mm' },
  jointClearanceMm: { min: 0.2, max: 0.6, step: 0.05, unit: 'mm' },
  mechanicalGapMm: { min: 0.4, max: 1.5, step: 0.1, unit: 'mm' },
  maxJointAngleDeg: { min: 15, max: 50, step: 1, unit: '°' },
  cornerRadiusMm: { min: 1.5, max: 12, step: 0.5, unit: 'mm' },
  stakeLengthMm: { min: 24, max: 100, step: 1, unit: 'mm' },
  nameplateTiltDeg: { min: 0, max: 90, step: 1, unit: '°' },
  nameplateEmbedMm: { min: 0.2, max: 1.8, step: 0.1, unit: 'mm' },
  reliefHaloMm: { min: 0, max: 2, step: 0.1, unit: 'mm' },
  ringOffsetMm: { min: -3, max: 3, step: 0.1, unit: 'mm' },
  bubbleLobeMm: { min: 0, max: 4, step: 0.1, unit: 'mm' },
  tagTailMm: { min: 0, max: 4, step: 0.1, unit: 'mm' },
  archCurveMm: { min: 0, max: 6, step: 0.1, unit: 'mm' },
  stakeShoulderMm: { min: 0, max: 8, step: 0.1, unit: 'mm' },
  jointBossMm: { min: 0, max: 3, step: 0.1, unit: 'mm' },
} satisfies Record<ShapeParameter, ParameterRange>;
export const PARAMETER_DEFINITIONS: Record<ShapeParameter, ParameterDefinition> =
  Object.fromEntries(
    (Object.keys(PARAMETER_RANGES) as ShapeParameter[]).map((parameter) => [
      parameter,
      {
        ...PARAMETER_RANGES[parameter],
        labelKey:
          parameter === 'textSizeMm'
            ? 'textSize'
            : parameter === 'reliefHaloMm'
              ? 'reliefHalo'
              : parameter === 'ringOffsetMm'
                ? 'ringOffset'
                : parameter === 'bubbleLobeMm'
                  ? 'bubbleLobe'
                  : parameter === 'tagTailMm'
                    ? 'tagTail'
                    : parameter === 'archCurveMm'
                      ? 'archCurve'
                      : parameter === 'stakeShoulderMm'
                        ? 'stakeShoulder'
                        : parameter === 'jointBossMm'
                          ? 'jointBoss'
                          : parameter,
        dependencies:
          parameter === 'paddingMm' || parameter === 'reliefHaloMm'
            ? (['textSizeMm'] as const)
            : parameter === 'reliefDepthMm'
              ? (['baseThicknessMm'] as const)
              : parameter === 'jointBossMm'
                ? (['connectorWidthMm', 'jointClearanceMm'] as const)
                : parameter === 'cornerRadiusMm'
                  ? (['textSizeMm', 'paddingMm', 'nameplateEmbedMm', 'nameplateTiltDeg'] as const)
                  : ([] as const),
        randomization: 'uniform' as const,
      },
    ]),
  ) as unknown as Record<ShapeParameter, ParameterDefinition>;
export const CUSTOMIZER_PARAMETER_DEFINITIONS = {
  plantAccentEnabled: {
    labelKey: 'plantAccents',
    dependencies: [] as const,
    randomization: 'boolean' as const,
  },
  ...PARAMETER_DEFINITIONS,
} as const;
const COMMON_PARAMETERS: readonly ShapeParameter[] = ['textSizeMm', 'baseThicknessMm'];
const STANDARD_TEXT_PARAMETERS: readonly ShapeParameter[] = ['fontWeightMm', 'edgeInsetMm'];
const RELIEF_PARAMETERS: readonly ShapeParameter[] = ['reliefDepthMm'];
export const TEMPLATE_PARAMETER_KEYS: Record<TemplateId, readonly ShapeParameter[]> = {
  'name-keychain': [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'letterSpacingMm',
    'holeDiameterMm',
    'reliefHaloMm',
    'ringOffsetMm',
    'bubbleLobeMm',
    'tagTailMm',
    'archCurveMm',
  ],
  'articulated-name': [
    ...COMMON_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'holeDiameterMm',
    'connectorWidthMm',
    'jointClearanceMm',
    'mechanicalGapMm',
    'maxJointAngleDeg',
    'jointBossMm',
    'ringOffsetMm',
  ],
  nameplate: [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'nameplateTiltDeg',
    'nameplateEmbedMm',
    'cornerRadiusMm',
    'reliefHaloMm',
  ],
  'plant-label': [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'letterSpacingMm',
    'cornerRadiusMm',
    'stakeLengthMm',
    'stakeShoulderMm',
    'bubbleLobeMm',
    'tagTailMm',
    'archCurveMm',
  ],
};
export const templateParameterKeys = (templateId: TemplateId): readonly ShapeParameter[] => {
  return TEMPLATE_PARAMETER_KEYS[templateId];
};
export const hasTemplateParameter = (
  templateId: TemplateId,
  parameter: CustomizerParameter,
): boolean => {
  if (parameter === 'plantAccentEnabled') return templateId === 'plant-label';
  return templateParameterKeys(templateId).includes(parameter as ShapeParameter);
};

/** Parameters that are meaningful for the currently selected template and style. */
export const hasActiveParameter = (
  params: KeychainParams,
  parameter: CustomizerParameter,
): boolean => {
  if (!hasTemplateParameter(params.templateId, parameter)) return false;
  if (parameter === 'plantAccentEnabled')
    return ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'].includes(params.styleId);
  const styleParameter: Partial<Record<ShapeParameter, StyleId>> = {
    bubbleLobeMm: 'bubble',
    tagTailMm: 'soft-tag',
    archCurveMm: 'arch',
  };
  if (
    styleParameter[parameter as ShapeParameter] &&
    styleParameter[parameter as ShapeParameter] !== params.styleId
  )
    return false;
  return !(
    parameter === 'cornerRadiusMm' &&
    params.templateId === 'plant-label' &&
    params.styleId === 'capsule'
  );
};

const roundedDown = (value: number, step: number): number => Math.floor(value / step) * step;

/**
 * Limits controls to values the active generator can use without silently
 * clamping them. These formulas mirror the corresponding template builders.
 */
export const parameterRange = (
  params: KeychainParams,
  parameter: ShapeParameter,
): ParameterRange => {
  if (parameter === 'reliefHaloMm') {
    const range = PARAMETER_RANGES.reliefHaloMm;
    return { ...range, max: Math.min(range.max, Math.max(range.min, params.paddingMm)) };
  }
  if (parameter === 'ringOffsetMm') {
    const range = PARAMETER_RANGES.ringOffsetMm;
    const limit = Math.max(0.5, Math.min(3, params.textSizeMm * 0.2));
    return { ...range, min: -limit, max: limit };
  }
  if (parameter === 'jointBossMm') {
    const range = PARAMETER_RANGES.jointBossMm;
    return { ...range, max: Math.min(range.max, Math.max(0, params.connectorWidthMm * 0.75)) };
  }
  if (parameter === 'baseThicknessMm' && params.templateId === 'articulated-name')
    return { ...PARAMETER_RANGES.baseThicknessMm, min: 3.4 };

  if (parameter === 'nameplateEmbedMm') {
    const range = PARAMETER_RANGES.nameplateEmbedMm;
    return {
      ...range,
      max: Math.max(
        range.min,
        roundedDown(Math.min(range.max, params.baseThicknessMm - 0.3), range.step),
      ),
    };
  }

  if (parameter === 'cornerRadiusMm') {
    const range = PARAMETER_RANGES.cornerRadiusMm;
    if (params.templateId === 'plant-label') {
      const foundationHeight = Math.max(5, Math.min(8, params.textSizeMm * 0.26));
      return {
        ...range,
        max: Math.max(range.min, roundedDown(foundationHeight / 2 - 0.5, range.step)),
      };
    }
    if (params.templateId === 'nameplate') {
      const textDepth = params.nameplateEmbedMm + params.reliefDepthMm;
      const tiltMargin = Math.abs(Math.sin((params.nameplateTiltDeg * Math.PI) / 180)) * textDepth;
      const height = Math.max(18, params.textSizeMm + params.paddingMm * 2 + tiltMargin * 2);
      return {
        ...range,
        max: Math.max(
          range.min,
          roundedDown(Math.min(range.max, height / 2 - params.paddingMm - 0.25), range.step),
        ),
      };
    }
  }

  return PARAMETER_RANGES[parameter];
};
