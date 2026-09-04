import { DEFAULT_PARAMS, type KeychainParams, type StyleId, type TemplateId } from './types';
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
  /** Canonical default used when a control is reset or is not applicable. */
  defaultValue: number;
  /** Whether this control contributes to the selected template/style. */
  applicable: (params: Pick<KeychainParams, 'templateId' | 'styleId'>) => boolean;
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
  | 'jointBossMm'
  | 'ribbonTailMm'
  | 'ribbonNotchMm'
  | 'heartSizeMm'
  | 'heartBorderMm'
  | 'heartLeftGapMm'
  | 'heartRightGapMm'
  | 'heartVerticalOffsetMm';
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
  ribbonTailMm: { min: 6, max: 24, step: 0.5, unit: 'mm' },
  ribbonNotchMm: { min: 1, max: 10, step: 0.5, unit: 'mm' },
  heartSizeMm: { min: 12, max: 32, step: 0.5, unit: 'mm' },
  heartBorderMm: { min: 1.2, max: 4, step: 0.1, unit: 'mm' },
  heartLeftGapMm: { min: -6, max: 12, step: 0.1, unit: 'mm' },
  heartRightGapMm: { min: -6, max: 12, step: 0.1, unit: 'mm' },
  heartVerticalOffsetMm: { min: -10, max: 10, step: 0.5, unit: 'mm' },
} satisfies Record<ShapeParameter, ParameterRange>;
export const PARAMETER_DEFINITIONS: Record<ShapeParameter, ParameterDefinition> =
  Object.fromEntries(
    (Object.keys(PARAMETER_RANGES) as ShapeParameter[]).map((parameter) => [
      parameter,
      {
        ...PARAMETER_RANGES[parameter],
        labelKey: (
          {
            textSizeMm: 'textSize',
            fontWeightMm: 'fontWeight',
            baseThicknessMm: 'baseThickness',
            reliefDepthMm: 'raisedText',
            paddingMm: 'borderPadding',
            edgeInsetMm: 'backingSize',
            letterSpacingMm: 'letterSpacing',
            holeDiameterMm: 'keyringHole',
            connectorWidthMm: 'connectorWidth',
            jointClearanceMm: 'jointClearance',
            mechanicalGapMm: 'mechanicalGap',
            maxJointAngleDeg: 'maxJointAngle',
            cornerRadiusMm: 'cornerRadius',
            stakeLengthMm: 'stakeLength',
            nameplateTiltDeg: 'textTilt',
            nameplateEmbedMm: 'embedDepth',
            reliefHaloMm: 'reliefHalo',
            ringOffsetMm: 'keyringHoleOffset',
            bubbleLobeMm: 'bubbleLobe',
            tagTailMm: 'tagTail',
            archCurveMm: 'archCurve',
            stakeShoulderMm: 'stakeShoulder',
            jointBossMm: 'jointBoss',
            ribbonTailMm: 'ribbonTail',
            ribbonNotchMm: 'ribbonNotch',
            heartSizeMm: 'heartSize',
            heartBorderMm: 'heartBorder',
            heartLeftGapMm: 'heartLeftGap',
            heartRightGapMm: 'heartRightGap',
            heartVerticalOffsetMm: 'heartVerticalOffset',
          } satisfies Record<ShapeParameter, string>
        )[parameter],
        dependencies:
          parameter === 'paddingMm' || parameter === 'reliefHaloMm'
            ? (['textSizeMm'] as const)
            : parameter === 'reliefDepthMm'
              ? (['baseThicknessMm'] as const)
              : parameter === 'jointBossMm'
                ? (['connectorWidthMm', 'jointClearanceMm'] as const)
                : parameter === 'heartBorderMm'
                  ? (['heartSizeMm'] as const)
                  : parameter === 'cornerRadiusMm'
                    ? (['textSizeMm', 'paddingMm', 'nameplateEmbedMm', 'nameplateTiltDeg'] as const)
                    : ([] as const),
        randomization: 'uniform' as const,
        defaultValue: DEFAULT_PARAMS[parameter],
        applicable: (params: Pick<KeychainParams, 'templateId' | 'styleId'>) =>
          hasTemplateParameter(params.templateId, parameter) &&
          !(parameter === 'bubbleLobeMm' && params.styleId !== 'bubble') &&
          !(parameter === 'tagTailMm' && params.styleId !== 'soft-tag') &&
          !(parameter === 'archCurveMm' && params.styleId !== 'arch') &&
          !(parameter === 'ribbonTailMm' && params.styleId !== 'ribbon') &&
          !(parameter === 'ribbonNotchMm' && params.styleId !== 'ribbon') &&
          !(
            parameter === 'cornerRadiusMm' &&
            params.templateId === 'plant-label' &&
            params.styleId === 'capsule'
          ),
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
/** Single registry consumed by controls, randomization, and normalization. */
export const PARAMETER_REGISTRY = PARAMETER_DEFINITIONS;
/** Presentation groups for the registry-driven controls in Shape > Figure. */
export const PARAMETER_GROUPS = [
  {
    key: 'common',
    parameters: [
      'baseThicknessMm',
      'paddingMm',
      'edgeInsetMm',
      'holeDiameterMm',
      'ringOffsetMm',
    ] as const,
  },
  {
    key: 'relief',
    parameters: ['reliefHaloMm'] as const,
  },
  {
    key: 'outline',
    parameters: ['cornerRadiusMm', 'bubbleLobeMm', 'tagTailMm', 'archCurveMm'] as const,
  },
  {
    key: 'templateDetails',
    parameters: [
      'nameplateTiltDeg',
      'nameplateEmbedMm',
      'stakeLengthMm',
      'stakeShoulderMm',
      'ribbonTailMm',
      'ribbonNotchMm',
    ] as const,
  },
  {
    key: 'heart',
    parameters: [
      'heartSizeMm',
      'heartBorderMm',
      'heartLeftGapMm',
      'heartRightGapMm',
      'heartVerticalOffsetMm',
    ] as const,
  },
  {
    key: 'mechanics',
    parameters: [
      'connectorWidthMm',
      'jointClearanceMm',
      'mechanicalGapMm',
      'maxJointAngleDeg',
      'jointBossMm',
    ] as const,
  },
] as const satisfies readonly {
  key: string;
  parameters: readonly ShapeParameter[];
}[];
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
    'ribbonTailMm',
    'ribbonNotchMm',
    'heartSizeMm',
    'heartBorderMm',
    'heartLeftGapMm',
    'heartRightGapMm',
    'heartVerticalOffsetMm',
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
  magnet: [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'letterSpacingMm',
    'cornerRadiusMm',
    'bubbleLobeMm',
    'tagTailMm',
    'archCurveMm',
    'ribbonTailMm',
    'ribbonNotchMm',
  ],
};
export const templateParameterKeys = (templateId: TemplateId): readonly ShapeParameter[] => {
  return TEMPLATE_PARAMETER_KEYS[templateId];
};

/** Return active parameters in dependency-first order for deterministic updates. */
export const orderedTemplateParameterKeys = (templateId: TemplateId): readonly ShapeParameter[] => {
  const active = new Set(TEMPLATE_PARAMETER_KEYS[templateId]);
  const ordered: ShapeParameter[] = [];
  const visiting = new Set<ShapeParameter>();
  const visited = new Set<ShapeParameter>();
  const visit = (parameter: ShapeParameter): void => {
    if (visited.has(parameter) || !active.has(parameter)) return;
    if (visiting.has(parameter)) return;
    visiting.add(parameter);
    for (const dependency of PARAMETER_REGISTRY[parameter].dependencies) visit(dependency);
    visiting.delete(parameter);
    visited.add(parameter);
    ordered.push(parameter);
  };
  for (const parameter of TEMPLATE_PARAMETER_KEYS[templateId]) visit(parameter);
  return ordered;
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
    ribbonTailMm: 'ribbon',
    ribbonNotchMm: 'ribbon',
  };
  if (
    styleParameter[parameter as ShapeParameter] &&
    styleParameter[parameter as ShapeParameter] !== params.styleId
  )
    return false;
  if (
    [
      'heartSizeMm',
      'heartBorderMm',
      'heartLeftGapMm',
      'heartRightGapMm',
      'heartVerticalOffsetMm',
    ].includes(parameter as string)
  )
    return params.templateId === 'name-keychain' && params.styleId === 'heart-split';
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
  if (parameter === 'heartBorderMm') {
    const range = PARAMETER_RANGES.heartBorderMm;
    return { ...range, max: Math.max(range.min, Math.min(range.max, params.heartSizeMm * 0.2)) };
  }
  if (parameter === 'baseThicknessMm' && params.templateId === 'articulated-name')
    return { ...PARAMETER_RANGES.baseThicknessMm, min: 3.4 };
  if (parameter === 'baseThicknessMm' && params.templateId === 'magnet')
    return { ...PARAMETER_RANGES.baseThicknessMm, min: 4.4, max: 5 };

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
