import type { KeychainParams, TemplateId } from './types';
export type ParameterRange = {
  min: number;
  max: number;
  step: number;
  unit: 'mm' | '°';
};
export type ShapeParameter =
  | 'textHeightMm'
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
  | 'nameplateEmbedMm';
export type CustomizerParameter = ShapeParameter | 'plantAccentEnabled';
export const PARAMETER_RANGES = {
  textHeightMm: { min: 12, max: 30, step: 0.5, unit: 'mm' },
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
} satisfies Record<ShapeParameter, ParameterRange>;
const COMMON_PARAMETERS: readonly ShapeParameter[] = ['textHeightMm', 'baseThicknessMm'];
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
  ],
  'articulated-name': [
    ...COMMON_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'holeDiameterMm',
    'connectorWidthMm',
    'jointClearanceMm',
    'mechanicalGapMm',
    'maxJointAngleDeg',
  ],
  nameplate: [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'cornerRadiusMm',
    'nameplateTiltDeg',
    'nameplateEmbedMm',
  ],
  'plant-label': [
    ...COMMON_PARAMETERS,
    ...STANDARD_TEXT_PARAMETERS,
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'letterSpacingMm',
    'cornerRadiusMm',
    'stakeLengthMm',
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
  // Capsule plant labels derive their ends from the board height, so a separate
  // corner-radius setting cannot change that geometry.
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
      const foundationHeight = Math.max(5, Math.min(8, params.textHeightMm * 0.26));
      return {
        ...range,
        max: Math.max(range.min, roundedDown(foundationHeight / 2 - 0.5, range.step)),
      };
    }
    if (params.templateId === 'nameplate') {
      const textDepth = params.nameplateEmbedMm + params.reliefDepthMm;
      const tiltMargin = Math.abs(Math.sin((params.nameplateTiltDeg * Math.PI) / 180)) * textDepth;
      const height = Math.max(18, params.textHeightMm + params.paddingMm * 2 + tiltMargin * 2);
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
