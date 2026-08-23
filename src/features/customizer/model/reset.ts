import { DEFAULT_PARAMS, normalizeParams, type KeychainParams } from '../../../domain/keychain';

export type CustomizerResetSection = 'name' | 'subtitle' | 'template' | 'style' | 'font' | 'shape';

const SHAPE_DEFAULTS = {
  baseThicknessMm: DEFAULT_PARAMS.baseThicknessMm,
  paddingMm: DEFAULT_PARAMS.paddingMm,
  edgeInsetMm: DEFAULT_PARAMS.edgeInsetMm,
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
  reliefHaloMm: DEFAULT_PARAMS.reliefHaloMm,
  ringOffsetMm: DEFAULT_PARAMS.ringOffsetMm,
  bubbleLobeMm: DEFAULT_PARAMS.bubbleLobeMm,
  tagTailMm: DEFAULT_PARAMS.tagTailMm,
  archCurveMm: DEFAULT_PARAMS.archCurveMm,
  stakeShoulderMm: DEFAULT_PARAMS.stakeShoulderMm,
  jointBossMm: DEFAULT_PARAMS.jointBossMm,
  ribbonTailMm: DEFAULT_PARAMS.ribbonTailMm,
  ribbonNotchMm: DEFAULT_PARAMS.ribbonNotchMm,
} satisfies Partial<KeychainParams>;
const FONT_DEFAULTS = {
  textSizeMm: DEFAULT_PARAMS.textSizeMm,
  fontWeightMm: DEFAULT_PARAMS.fontWeightMm,
  reliefDepthMm: DEFAULT_PARAMS.reliefDepthMm,
  letterSpacingMm: DEFAULT_PARAMS.letterSpacingMm,
} satisfies Partial<KeychainParams>;
const SUBTITLE_DEFAULTS = {
  subtitleTextSizeMm: DEFAULT_PARAMS.subtitleTextSizeMm,
  subtitleFontWeightMm: DEFAULT_PARAMS.subtitleFontWeightMm,
  subtitleLetterSpacingMm: DEFAULT_PARAMS.subtitleLetterSpacingMm,
  subtitleReliefDepthMm: DEFAULT_PARAMS.subtitleReliefDepthMm,
  subtitleGapMm: DEFAULT_PARAMS.subtitleGapMm,
  subtitleOffsetXRatio: DEFAULT_PARAMS.subtitleOffsetXRatio,
  subtitleOffsetYRatio: DEFAULT_PARAMS.subtitleOffsetYRatio,
} satisfies Partial<KeychainParams>;

export const resetParamsForSection = (
  params: KeychainParams,
  section: CustomizerResetSection,
): KeychainParams => {
  if (section === 'name') return { ...params, text: DEFAULT_PARAMS.text };
  if (section === 'subtitle')
    return {
      ...params,
      subtitle: DEFAULT_PARAMS.subtitle,
      subtitleFontId: DEFAULT_PARAMS.subtitleFontId,
      ...SUBTITLE_DEFAULTS,
    };
  if (section === 'template')
    return {
      ...params,
      templateId: DEFAULT_PARAMS.templateId,
      styleId: DEFAULT_PARAMS.styleId,
    };
  if (section === 'style')
    return {
      ...params,
      styleId: params.templateId === 'magnet' ? 'plain' : DEFAULT_PARAMS.styleId,
      bubbleLobeMm: DEFAULT_PARAMS.bubbleLobeMm,
      tagTailMm: DEFAULT_PARAMS.tagTailMm,
      archCurveMm: DEFAULT_PARAMS.archCurveMm,
      ribbonTailMm: DEFAULT_PARAMS.ribbonTailMm,
      ribbonNotchMm: DEFAULT_PARAMS.ribbonNotchMm,
    };
  if (section === 'font')
    return {
      ...params,
      fontId: DEFAULT_PARAMS.fontId,
      ...FONT_DEFAULTS,
    };
  return normalizeParams({ ...params, ...SHAPE_DEFAULTS });
};
