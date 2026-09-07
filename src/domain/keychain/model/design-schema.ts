import type { KeychainParams, PrintAppearanceOverrides } from './types';

/** Each persisted parameter belongs to exactly one semantic section. */
export const DESIGN_SECTIONS = {
  content: [
    'text',
    'subtitle',
    'fontId',
    'subtitleFontId',
    'textSizeMm',
    'fontWeightMm',
    'subtitleTextSizeMm',
    'subtitleFontWeightMm',
    'modelFeatures',
  ],
  layout: [
    'letterSpacingMm',
    'subtitleLetterSpacingMm',
    'subtitleGapMm',
    'subtitleOffsetXRatio',
    'subtitleOffsetYRatio',
    'nameplateTiltDeg',
    'nameplateEmbedMm',
    'heartLeftGapMm',
    'heartRightGapMm',
    'heartVerticalOffsetMm',
  ],
  silhouette: [
    'templateId',
    'styleId',
    'paddingMm',
    'edgeInsetMm',
    'cornerRadiusMm',
    'bubbleLobeMm',
    'tagTailMm',
    'archCurveMm',
    'ribbonTailMm',
    'ribbonNotchMm',
    'heartSizeMm',
    'heartBorderMm',
    'heartInteriorMode',
    'stakeLengthMm',
    'stakeShoulderMm',
    'plantAccentEnabled',
  ],
  finish: [
    'baseThicknessMm',
    'reliefDepthMm',
    'subtitleReliefDepthMm',
    'reliefHaloMm',
    'edgeFinish',
    'topEdgeMm',
    'bottomEdgeMm',
    'textEdgeMm',
  ],
  hardware: [
    'holeDiameterMm',
    'ringOffsetMm',
    'magnetPocketPreset',
    'magnetPocketPlacement',
    'connectorWidthMm',
    'jointClearanceMm',
    'mechanicalGapMm',
    'maxJointAngleDeg',
    'jointBossMm',
  ],
  manufacturing: ['minimumWallMm', 'bottomClearanceMm'],
} as const satisfies Record<string, readonly (keyof KeychainParams)[]>;

export type DesignSection = keyof typeof DESIGN_SECTIONS;
export type DesignDocument = {
  version: 6;
  appearanceOverrides?: PrintAppearanceOverrides;
  fontFallback?: boolean;
} & {
  [Section in DesignSection]: Pick<KeychainParams, (typeof DESIGN_SECTIONS)[Section][number]>;
};

export const createDesignDocument = (
  params: KeychainParams,
  appearanceOverrides?: PrintAppearanceOverrides,
): DesignDocument =>
  ({
    version: 6,
    ...Object.fromEntries(
      Object.entries(DESIGN_SECTIONS).map(([section, keys]) => [
        section,
        Object.fromEntries(keys.map((key) => [key, params[key]])),
      ]),
    ),
    ...(appearanceOverrides ? { appearanceOverrides } : {}),
  }) as DesignDocument;

/** Compile the structured design into the kernel's current parameter interface. */
export const designParams = (document: DesignDocument): KeychainParams =>
  Object.assign(
    {},
    ...Object.keys(DESIGN_SECTIONS).map((section) => document[section as DesignSection]),
  ) as KeychainParams;
