import type { FontDefinition } from '../fonts/catalog';

export type StyleId = 'plain' | 'contour' | 'capsule' | 'soft-tag' | 'bubble' | 'arch' | 'ribbon';
export type TemplateId =
  'name-keychain' | 'articulated-name' | 'nameplate' | 'plant-label' | 'magnet';
export type MagnetPocketPreset = '6x2' | '8x2' | '10x3' | '12x3' | '15x3';
export type MagnetPocketPlacement = 'center' | 'upper' | 'lower' | 'left' | 'right';
export type MagnetPocketPresetMetadata = {
  id: MagnetPocketPreset;
  diameterMm: number;
  thicknessMm: number;
  pocketDiameterMm: number;
  pocketDepthMm: number;
};
export const MAGNET_POCKET_PRESETS: readonly MagnetPocketPresetMetadata[] = [
  { id: '6x2', diameterMm: 6, thicknessMm: 2, pocketDiameterMm: 6.4, pocketDepthMm: 2.2 },
  { id: '8x2', diameterMm: 8, thicknessMm: 2, pocketDiameterMm: 8.4, pocketDepthMm: 2.2 },
  { id: '10x3', diameterMm: 10, thicknessMm: 3, pocketDiameterMm: 10.4, pocketDepthMm: 3.2 },
  { id: '12x3', diameterMm: 12, thicknessMm: 3, pocketDiameterMm: 12.4, pocketDepthMm: 3.2 },
  { id: '15x3', diameterMm: 15, thicknessMm: 3, pocketDiameterMm: 15.4, pocketDepthMm: 3.2 },
];
export const MAGNET_POCKET_PRESET_MAP = Object.fromEntries(
  MAGNET_POCKET_PRESETS.map((preset) => [preset.id, preset]),
) as Record<MagnetPocketPreset, MagnetPocketPresetMetadata>;
export type KeychainParams = {
  text: string;
  subtitle: string;
  subtitleFontId: string;
  subtitleOffsetXRatio: number;
  subtitleOffsetYRatio: number;
  magnetPocketPreset: MagnetPocketPreset;
  magnetPocketPlacement: MagnetPocketPlacement;
  fontId: string;
  templateId: TemplateId;
  styleId: StyleId;
  textSizeMm: number;
  fontWeightMm: number;
  baseThicknessMm: number;
  reliefDepthMm: number;
  paddingMm: number;
  edgeInsetMm: number;
  letterSpacingMm: number;
  holeDiameterMm: number;
  connectorWidthMm: number;
  cornerRadiusMm: number;
  stakeLengthMm: number;
  plantAccentEnabled: boolean;
  nameplateTiltDeg: number;
  nameplateEmbedMm: number;
  jointClearanceMm: number;
  mechanicalGapMm: number;
  maxJointAngleDeg: number;
  minimumWallMm: number;
  bottomClearanceMm: number;
  reliefHaloMm: number;
  ringOffsetMm: number;
  bubbleLobeMm: number;
  tagTailMm: number;
  archCurveMm: number;
  stakeShoulderMm: number;
  jointBossMm: number;
  ribbonTailMm: number;
  ribbonNotchMm: number;
  subtitleTextSizeMm?: number;
  subtitleFontWeightMm?: number;
  subtitleLetterSpacingMm?: number;
  subtitleReliefDepthMm?: number;
  subtitleGapMm?: number;
};
export const MAGNET_SUBTITLE_MAX_LENGTH = 24;
export const DEFAULT_MAGNET_POCKET_PRESET: MagnetPocketPreset = '10x3';
export const DEFAULT_MAGNET_POCKET_PLACEMENT: MagnetPocketPlacement = 'center';
export const magnetTextContent = (text: string, subtitle: string): string =>
  subtitle ? `${text} ${subtitle}` : text;
export const supportsMagnetSubtitle = (text: string, subtitle: string): boolean =>
  Boolean(text.trim()) && [...subtitle].length <= MAGNET_SUBTITLE_MAX_LENGTH;
export type NormalizedParams = KeychainParams;
export type KeyringMetrics = {
  wallMm: number;
  outerRadiusMm: number;
  rootWidthMm: number;
  overlapMm: number;
};
export type MeshBuffer = {
  positions: Float32Array;
  indices: Uint32Array;
};
export type ExportFormat = 'stl' | '3mf';
export type ThreeMfMode = 'separate-colors' | 'merged';
export type Dimensions = {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  centerMm: [number, number, number];
};
export type ValidationIssue = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
};
/** Manufacturing limits carried alongside generated geometry. All values are millimetres. */
export type GeometryConstraints = {
  minimumWallMm: number;
  minimumClearanceMm: number;
  maximumWidthMm: number;
};
/** The assumptions under which geometry validation and printability are evaluated. */
export type PrintProfile = {
  id: string;
  technology: 'fdm';
  nozzleDiameterMm: number;
  layerHeightMm: number;
  supports: boolean;
  recommendedOrientation: 'flat' | 'custom';
  maxUnsupportedOverhangDeg: number;
  constraints: GeometryConstraints;
};
export const DEFAULT_GEOMETRY_CONSTRAINTS: GeometryConstraints = {
  minimumWallMm: 1.2,
  minimumClearanceMm: 0.2,
  maximumWidthMm: 120,
};
export const DEFAULT_PRINT_PROFILE: PrintProfile = {
  id: 'fdm-standard-0.4',
  technology: 'fdm',
  nozzleDiameterMm: 0.4,
  layerHeightMm: 0.2,
  supports: false,
  recommendedOrientation: 'flat',
  maxUnsupportedOverhangDeg: 45,
  constraints: DEFAULT_GEOMETRY_CONSTRAINTS,
};
export const geometryConstraintsFor = (
  params: Pick<
    KeychainParams,
    'templateId' | 'minimumWallMm' | 'jointClearanceMm' | 'mechanicalGapMm'
  >,
): GeometryConstraints => ({
  minimumWallMm: params.minimumWallMm,
  minimumClearanceMm: Math.max(
    DEFAULT_GEOMETRY_CONSTRAINTS.minimumClearanceMm,
    ...(params.templateId === 'articulated-name'
      ? [params.jointClearanceMm, params.mechanicalGapMm]
      : []),
  ),
  maximumWidthMm: DEFAULT_GEOMETRY_CONSTRAINTS.maximumWidthMm,
});
export const printProfileFor = (constraints: GeometryConstraints): PrintProfile => ({
  ...DEFAULT_PRINT_PROFILE,
  constraints,
});
export type PrintAppearance = {
  base: {
    name: string;
    color: string;
  };
  relief: {
    name: string;
    color: string;
  };
};
/** Session-only color choices. Geometry and hosted project data remain unchanged. */
export type PrintAppearanceOverrides = {
  version: 1;
  base?: string;
  relief?: string;
};
export const normalizeAppearanceColor = (color: string | undefined, fallback: string): string => {
  if (color === undefined) return fallback;
  const value = color?.trim().toUpperCase() ?? '';
  if (!/^#[0-9A-F]{6}$/.test(value)) throw new Error(`Invalid appearance color: ${color}`);
  return value;
};
export const applyPrintAppearanceOverrides = (
  appearance: PrintAppearance,
  overrides?: PrintAppearanceOverrides,
): PrintAppearance => ({
  ...appearance,
  base: {
    ...appearance.base,
    color: normalizeAppearanceColor(overrides?.base, appearance.base.color),
  },
  relief: {
    ...appearance.relief,
    color: normalizeAppearanceColor(overrides?.relief, appearance.relief.color),
  },
});
export const DEFAULT_PRINT_APPEARANCE: PrintAppearance = {
  base: { name: 'Backing', color: '#B84838' },
  relief: { name: 'Raised text', color: '#FAF4E9' },
};
export const ARTICULATED_PRINT_APPEARANCE: PrintAppearance = {
  base: { name: 'Structural letters and connectors', color: '#E7E2DA' },
  relief: { name: 'Decorative letter caps', color: '#D94A52' },
};
export type GeometryResult = {
  generationId: number;
  baseMesh: MeshBuffer;
  reliefMesh: MeshBuffer;
  dimensions: Dimensions;
  issues: ValidationIssue[];
  printable: boolean;
  appearance: PrintAppearance;
  /** Effective limits used by this generation. Optional for backwards-compatible consumers. */
  constraints?: GeometryConstraints;
  printProfile?: PrintProfile;
  baseShading?: 'creased' | 'flat';
  solidCount?: number;
  magnetPocket?: MagnetPocketMetadata;
};
export type MagnetPocketMetadata = {
  preset: MagnetPocketPreset;
  placement: MagnetPocketPlacement;
  diameterMm: number;
  depthMm: number;
  centerMm: [number, number];
  adjusted: boolean;
  safe: boolean;
};
/** A complete candidate result, kept separate from the preview queue. */
export type GeometryValidation = Omit<GeometryResult, 'generationId'>;

/** Reject malformed worker payloads before they can reach rendering or export. */
export const validateGeometryResult = (result: GeometryResult): boolean => {
  const meshValid = (mesh: MeshBuffer): boolean =>
    mesh.positions instanceof Float32Array &&
    mesh.indices instanceof Uint32Array &&
    mesh.positions.length % 3 === 0 &&
    [...mesh.positions].every(Number.isFinite) &&
    [...mesh.indices].every(Number.isFinite) &&
    [...mesh.indices].every((index) => index < mesh.positions.length / 3);
  const dimensionsValid = Object.values(result.dimensions).every((value) =>
    Array.isArray(value)
      ? value.length === 3 && value.every(Number.isFinite)
      : Number.isFinite(value),
  );
  return (
    Number.isInteger(result.generationId) &&
    meshValid(result.baseMesh) &&
    meshValid(result.reliefMesh) &&
    dimensionsValid &&
    Array.isArray(result.issues) &&
    result.issues.every(
      (issue) =>
        (issue.severity === 'warning' || issue.severity === 'error') &&
        typeof issue.code === 'string' &&
        typeof issue.message === 'string',
    ) &&
    typeof result.printable === 'boolean' &&
    !!result.appearance &&
    (!result.magnetPocket ||
      (['6x2', '8x2', '10x3', '12x3', '15x3'].includes(result.magnetPocket.preset) &&
        ['center', 'upper', 'lower', 'left', 'right'].includes(result.magnetPocket.placement) &&
        Number.isFinite(result.magnetPocket.diameterMm) &&
        Number.isFinite(result.magnetPocket.depthMm) &&
        result.magnetPocket.centerMm.length === 2 &&
        result.magnetPocket.centerMm.every(Number.isFinite) &&
        typeof result.magnetPocket.adjusted === 'boolean' &&
        typeof result.magnetPocket.safe === 'boolean'))
  );
};
export type WorkerRequest =
  | {
      type: 'warmup';
    }
  | {
      type: 'generate';
      requestId: number;
      params: KeychainParams;
      fontDefinition?: FontDefinition;
      subtitleFontDefinition?: FontDefinition;
    }
  | {
      type: 'validate';
      requestId: number;
      params: KeychainParams;
      fontDefinition?: FontDefinition;
      subtitleFontDefinition?: FontDefinition;
    }
  | {
      type: 'export';
      requestId: number;
      params: KeychainParams;
      format?: ExportFormat;
      mode?: ThreeMfMode;
      appearanceOverrides?: PrintAppearanceOverrides;
      fontDefinition?: FontDefinition;
      subtitleFontDefinition?: FontDefinition;
    };
export type WorkerResponse =
  | {
      type: 'geometry';
      requestId: number;
      result: Omit<GeometryResult, 'generationId'>;
    }
  | {
      type: 'validation';
      requestId: number;
      result: GeometryValidation;
    }
  | {
      type: 'export';
      requestId: number;
      filename: string;
      mimeType: string;
      data: ArrayBuffer;
    }
  | {
      type: 'error';
      requestId: number;
      message: string;
    };
export const DEFAULT_PARAMS: KeychainParams = {
  text: 'ALEX',
  subtitle: '',
  subtitleFontId: 'nunito',
  subtitleOffsetXRatio: 0,
  subtitleOffsetYRatio: 0,
  magnetPocketPreset: DEFAULT_MAGNET_POCKET_PRESET,
  magnetPocketPlacement: DEFAULT_MAGNET_POCKET_PLACEMENT,
  fontId: 'nunito',
  templateId: 'name-keychain',
  styleId: 'contour',
  textSizeMm: 20,
  fontWeightMm: 0.6,
  baseThicknessMm: 2.4,
  reliefDepthMm: 1,
  paddingMm: 2.4,
  edgeInsetMm: 2.4,
  letterSpacingMm: 1,
  holeDiameterMm: 5,
  connectorWidthMm: 1.8,
  cornerRadiusMm: 4,
  stakeLengthMm: 48,
  plantAccentEnabled: true,
  nameplateTiltDeg: 6,
  nameplateEmbedMm: 0.4,
  jointClearanceMm: 0.35,
  mechanicalGapMm: 0.6,
  maxJointAngleDeg: 35,
  minimumWallMm: 1.2,
  bottomClearanceMm: 0.25,
  reliefHaloMm: 0,
  ringOffsetMm: 0,
  bubbleLobeMm: 0,
  tagTailMm: 0,
  archCurveMm: 0,
  stakeShoulderMm: 0,
  jointBossMm: 0,
  ribbonTailMm: 12,
  ribbonNotchMm: 4,
  subtitleTextSizeMm: 6,
  subtitleFontWeightMm: 0,
  subtitleLetterSpacingMm: 0.5,
  subtitleReliefDepthMm: 0.8,
  subtitleGapMm: 1.5,
};
export const normalizeParams = (params: KeychainParams): NormalizedParams => {
  const text = params.text.normalize('NFC').trim().replace(/\s+/g, ' ');
  const baseThicknessMm = clamp(
    params.baseThicknessMm,
    params.templateId === 'articulated-name' ? 3.4 : params.templateId === 'magnet' ? 4.4 : 1.6,
    params.templateId === 'magnet' ? 5 : 4,
  );
  const normalized: NormalizedParams = {
    ...params,
    text,
    styleId:
      params.templateId === 'magnet' &&
      !['plain', 'contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'ribbon'].includes(
        params.styleId,
      )
        ? 'plain'
        : params.styleId === 'ribbon' &&
            params.templateId !== 'name-keychain' &&
            params.templateId !== 'magnet'
          ? 'contour'
          : params.styleId,
    subtitle:
      params.templateId !== 'articulated-name'
        ? (params.subtitle ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
        : '',
    subtitleFontId:
      params.templateId !== 'articulated-name' && params.subtitleFontId?.trim()
        ? params.subtitleFontId.trim()
        : DEFAULT_PARAMS.subtitleFontId,
    subtitleOffsetXRatio:
      params.templateId !== 'articulated-name' ? clamp(params.subtitleOffsetXRatio ?? 0, -1, 1) : 0,
    subtitleOffsetYRatio:
      params.templateId !== 'articulated-name' ? clamp(params.subtitleOffsetYRatio ?? 0, -1, 1) : 0,
    magnetPocketPreset:
      params.templateId === 'magnet' &&
      ['6x2', '8x2', '10x3', '12x3', '15x3'].includes(params.magnetPocketPreset)
        ? params.magnetPocketPreset
        : DEFAULT_MAGNET_POCKET_PRESET,
    magnetPocketPlacement:
      params.templateId === 'magnet' &&
      ['center', 'upper', 'lower', 'left', 'right'].includes(params.magnetPocketPlacement)
        ? params.magnetPocketPlacement
        : DEFAULT_MAGNET_POCKET_PLACEMENT,
    templateId: params.templateId ?? 'name-keychain',
    textSizeMm: clamp(params.textSizeMm, 12, 30),
    fontWeightMm: clamp(params.fontWeightMm ?? 0, 0, 1.5),
    baseThicknessMm,
    reliefDepthMm: clamp(params.reliefDepthMm, 0.6, 2),
    paddingMm: clamp(params.paddingMm, 1.2, 5),
    edgeInsetMm: clamp(params.edgeInsetMm ?? params.paddingMm, 0.8, 4),
    letterSpacingMm: clamp(params.letterSpacingMm ?? 1, 0, 8),
    holeDiameterMm: clamp(params.holeDiameterMm, 3, 7),
    connectorWidthMm: clamp(params.connectorWidthMm ?? 1.8, 1.4, 3),
    cornerRadiusMm: clamp(params.cornerRadiusMm ?? 4, 1.5, 12),
    stakeLengthMm: clamp(params.stakeLengthMm ?? 48, 24, 100),
    plantAccentEnabled: params.plantAccentEnabled ?? true,
    nameplateTiltDeg: clamp(params.nameplateTiltDeg ?? 6, 0, 90),
    nameplateEmbedMm: clamp(
      params.nameplateEmbedMm ?? 0.4,
      0.2,
      Math.max(0.2, baseThicknessMm - 0.3),
    ),
    jointClearanceMm: clamp(params.jointClearanceMm ?? 0.35, 0.2, 0.6),
    mechanicalGapMm: clamp(params.mechanicalGapMm ?? 0.6, 0.4, 1.5),
    maxJointAngleDeg: clamp(params.maxJointAngleDeg ?? 35, 15, 50),
    minimumWallMm: clamp(params.minimumWallMm ?? 1.2, 0.8, 3),
    bottomClearanceMm: clamp(params.bottomClearanceMm ?? 0.25, 0.15, 0.6),
    reliefHaloMm:
      params.templateId === 'name-keychain' || params.templateId === 'nameplate'
        ? clamp(params.reliefHaloMm ?? 0, 0, 2)
        : 0,
    ringOffsetMm:
      params.templateId === 'name-keychain' || params.templateId === 'articulated-name'
        ? clamp(params.ringOffsetMm ?? 0, -3, 3)
        : 0,
    bubbleLobeMm:
      params.styleId === 'bubble' &&
      (params.templateId === 'name-keychain' ||
        params.templateId === 'plant-label' ||
        params.templateId === 'magnet')
        ? clamp(params.bubbleLobeMm ?? 0, 0, 4)
        : 0,
    tagTailMm:
      params.styleId === 'soft-tag' &&
      (params.templateId === 'name-keychain' ||
        params.templateId === 'plant-label' ||
        params.templateId === 'magnet')
        ? clamp(params.tagTailMm ?? 0, 0, 4)
        : 0,
    archCurveMm:
      params.styleId === 'arch' &&
      (params.templateId === 'name-keychain' ||
        params.templateId === 'plant-label' ||
        params.templateId === 'magnet')
        ? clamp(params.archCurveMm ?? 0, 0, 6)
        : 0,
    stakeShoulderMm:
      params.templateId === 'plant-label' ? clamp(params.stakeShoulderMm ?? 0, 0, 8) : 0,
    jointBossMm:
      params.templateId === 'articulated-name' ? clamp(params.jointBossMm ?? 0, 0, 3) : 0,
    ribbonTailMm:
      params.styleId === 'ribbon' &&
      (params.templateId === 'name-keychain' || params.templateId === 'magnet')
        ? clamp(params.ribbonTailMm ?? 12, 6, 24)
        : 0,
    ribbonNotchMm:
      params.styleId === 'ribbon' &&
      (params.templateId === 'name-keychain' || params.templateId === 'magnet')
        ? clamp(params.ribbonNotchMm ?? 4, 1, 10)
        : 0,
    subtitleTextSizeMm: clamp(params.subtitleTextSizeMm ?? 6, 4, 12),
    subtitleFontWeightMm: clamp(params.subtitleFontWeightMm ?? 0, 0, 1.5),
    subtitleLetterSpacingMm: clamp(params.subtitleLetterSpacingMm ?? 0.5, 0, 4),
    subtitleReliefDepthMm: clamp(params.subtitleReliefDepthMm ?? 0.8, 0.4, 1.5),
    subtitleGapMm: clamp(params.subtitleGapMm ?? 1.5, 1.5, 8),
  };
  if (normalized.templateId === 'magnet')
    normalized.baseThicknessMm = clamp(params.baseThicknessMm, 4.4, 5);
  if (normalized.templateId !== 'name-keychain' && normalized.templateId !== 'nameplate')
    normalized.reliefHaloMm = 0;
  if (normalized.templateId !== 'name-keychain' && normalized.templateId !== 'articulated-name')
    normalized.ringOffsetMm = 0;
  if (
    !(
      normalized.templateId === 'name-keychain' ||
      normalized.templateId === 'plant-label' ||
      normalized.templateId === 'magnet'
    ) ||
    normalized.styleId !== 'bubble'
  )
    normalized.bubbleLobeMm = 0;
  if (
    !(
      normalized.templateId === 'name-keychain' ||
      normalized.templateId === 'plant-label' ||
      normalized.templateId === 'magnet'
    ) ||
    normalized.styleId !== 'soft-tag'
  )
    normalized.tagTailMm = 0;
  if (
    !(
      normalized.templateId === 'name-keychain' ||
      normalized.templateId === 'plant-label' ||
      normalized.templateId === 'magnet'
    ) ||
    normalized.styleId !== 'arch'
  )
    normalized.archCurveMm = 0;
  if (normalized.templateId !== 'plant-label') normalized.stakeShoulderMm = 0;
  if (normalized.templateId === 'plant-label') {
    const foundationHeight = Math.max(5, Math.min(8, normalized.textSizeMm * 0.26));
    const cornerRadiusMax = Math.max(1.5, Math.floor((foundationHeight / 2 - 0.5) / 0.5) * 0.5);
    normalized.cornerRadiusMm = clamp(normalized.cornerRadiusMm, 1.5, cornerRadiusMax);
  }
  if (normalized.templateId !== 'articulated-name') normalized.jointBossMm = 0;
  if (normalized.templateId !== 'magnet') {
    normalized.magnetPocketPreset = DEFAULT_MAGNET_POCKET_PRESET;
    normalized.magnetPocketPlacement = DEFAULT_MAGNET_POCKET_PLACEMENT;
  }
  if (
    !['name-keychain', 'magnet'].includes(normalized.templateId) ||
    normalized.styleId !== 'ribbon'
  ) {
    normalized.ribbonTailMm = 0;
    normalized.ribbonNotchMm = 0;
  }
  if (normalized.templateId === 'articulated-name') {
    normalized.fontWeightMm = 0;
    normalized.edgeInsetMm = normalized.paddingMm;
    normalized.letterSpacingMm = 0;
  }
  return normalized;
};
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};
export const ringWallMm = (holeDiameterMm: number): number => {
  return Math.max(2.2, Math.min(3.5, holeDiameterMm * 0.46));
};
export const keyringMetrics = (holeDiameterMm: number): KeyringMetrics => {
  const wallMm = ringWallMm(holeDiameterMm);
  return {
    wallMm,
    outerRadiusMm: holeDiameterMm / 2 + wallMm,
    rootWidthMm: Math.max(6, wallMm * 2.5),
    overlapMm: Math.max(5, wallMm * 2),
  };
};
export const sanitizeFilename = (
  text: string,
  styleId: string,
  extension: ExportFormat = 'stl',
): string => {
  const slug =
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48) || 'name';
  return `keychain-${slug}-${styleId}.${extension}`;
};
