import { DEFAULT_PARAMS, normalizeParams, type KeychainParams } from '../../../domain/keychain';

export type CustomizerResetSection = 'name' | 'template' | 'style' | 'font' | 'shape';

const SHAPE_DEFAULTS = {
  textHeightMm: DEFAULT_PARAMS.textHeightMm,
  fontWeightMm: DEFAULT_PARAMS.fontWeightMm,
  baseThicknessMm: DEFAULT_PARAMS.baseThicknessMm,
  reliefDepthMm: DEFAULT_PARAMS.reliefDepthMm,
  paddingMm: DEFAULT_PARAMS.paddingMm,
  edgeInsetMm: DEFAULT_PARAMS.edgeInsetMm,
  letterSpacingMm: DEFAULT_PARAMS.letterSpacingMm,
  holeDiameterMm: DEFAULT_PARAMS.holeDiameterMm,
  connectorWidthMm: DEFAULT_PARAMS.connectorWidthMm,
  cornerRadiusMm: DEFAULT_PARAMS.cornerRadiusMm,
  stakeLengthMm: DEFAULT_PARAMS.stakeLengthMm,
  plantAccentEnabled: DEFAULT_PARAMS.plantAccentEnabled,
  nameplateTiltDeg: DEFAULT_PARAMS.nameplateTiltDeg,
  nameplateEmbedMm: DEFAULT_PARAMS.nameplateEmbedMm,
  jointClearanceMm: DEFAULT_PARAMS.jointClearanceMm,
  mechanicalGapMm: DEFAULT_PARAMS.mechanicalGapMm,
  maxJointAngleDeg: DEFAULT_PARAMS.maxJointAngleDeg,
  minimumWallMm: DEFAULT_PARAMS.minimumWallMm,
  bottomClearanceMm: DEFAULT_PARAMS.bottomClearanceMm,
} satisfies Partial<KeychainParams>;

export const resetParamsForSection = (
  params: KeychainParams,
  section: CustomizerResetSection,
): KeychainParams => {
  if (section === 'name') return { ...params, text: DEFAULT_PARAMS.text };
  if (section === 'template')
    return {
      ...params,
      templateId: DEFAULT_PARAMS.templateId,
      styleId: DEFAULT_PARAMS.styleId,
    };
  if (section === 'style') return { ...params, styleId: DEFAULT_PARAMS.styleId };
  if (section === 'font') return { ...params, fontId: DEFAULT_PARAMS.fontId };
  return normalizeParams({ ...params, ...SHAPE_DEFAULTS });
};
