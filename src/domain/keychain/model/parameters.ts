import type { KeychainParams, TemplateId } from './types';
export type ParameterRange = {
  min: number;
  max: number;
  step: number;
  unit: 'mm' | '°';
};
export type ShapeParameter =
  | 'textHeightMm'
  | 'baseThicknessMm'
  | 'reliefDepthMm'
  | 'paddingMm'
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
export const PARAMETER_RANGES = {
  textHeightMm: { min: 12, max: 30, step: 0.5, unit: 'mm' },
  baseThicknessMm: { min: 1.6, max: 4, step: 0.1, unit: 'mm' },
  reliefDepthMm: { min: 0.6, max: 2, step: 0.1, unit: 'mm' },
  paddingMm: { min: 1.2, max: 5, step: 0.1, unit: 'mm' },
  letterSpacingMm: { min: 0, max: 8, step: 0.1, unit: 'mm' },
  holeDiameterMm: { min: 3, max: 7, step: 0.1, unit: 'mm' },
  connectorWidthMm: { min: 1.4, max: 3, step: 0.1, unit: 'mm' },
  jointClearanceMm: { min: 0.2, max: 0.8, step: 0.05, unit: 'mm' },
  mechanicalGapMm: { min: 0.4, max: 1.5, step: 0.1, unit: 'mm' },
  maxJointAngleDeg: { min: 15, max: 50, step: 1, unit: '°' },
  cornerRadiusMm: { min: 1.5, max: 12, step: 0.5, unit: 'mm' },
  stakeLengthMm: { min: 24, max: 100, step: 1, unit: 'mm' },
  nameplateTiltDeg: { min: 0, max: 45, step: 1, unit: '°' },
  nameplateEmbedMm: { min: 0.2, max: 1.8, step: 0.1, unit: 'mm' },
} satisfies Record<ShapeParameter, ParameterRange>;
const COMMON_PARAMETERS: readonly ShapeParameter[] = ['textHeightMm', 'baseThicknessMm'];
const RELIEF_PARAMETERS: readonly ShapeParameter[] = ['reliefDepthMm'];
export const TEMPLATE_PARAMETER_KEYS: Record<TemplateId, readonly ShapeParameter[]> = {
  'name-keychain': [...COMMON_PARAMETERS, ...RELIEF_PARAMETERS, 'paddingMm', 'letterSpacingMm', 'holeDiameterMm'],
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
    ...RELIEF_PARAMETERS,
    'paddingMm',
    'cornerRadiusMm',
    'nameplateTiltDeg',
    'nameplateEmbedMm',
  ],
  'plant-label': [
    ...COMMON_PARAMETERS,
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
export const hasTemplateParameter = (templateId: TemplateId, parameter: keyof KeychainParams): boolean => {
  return templateParameterKeys(templateId).includes(parameter as ShapeParameter);
};
