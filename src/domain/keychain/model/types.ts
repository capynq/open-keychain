import type { FontDefinition } from '../fonts/catalog';

export type StyleId = 'contour' | 'capsule' | 'soft-tag' | 'bubble' | 'arch';
export type TemplateId = 'name-keychain' | 'articulated-name' | 'nameplate' | 'plant-label';
export type KeychainParams = {
  text: string;
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
};
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
    }
  | {
      type: 'export';
      requestId: number;
      params: KeychainParams;
      format?: ExportFormat;
      mode?: ThreeMfMode;
      appearanceOverrides?: PrintAppearanceOverrides;
      fontDefinition?: FontDefinition;
    };
export type WorkerResponse =
  | {
      type: 'geometry';
      requestId: number;
      result: Omit<GeometryResult, 'generationId'>;
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
};
export const normalizeParams = (params: KeychainParams): NormalizedParams => {
  const text = params.text.normalize('NFC').trim().replace(/\s+/g, ' ');
  const baseThicknessMm = clamp(
    params.baseThicknessMm,
    params.templateId === 'articulated-name' ? 3.4 : 1.6,
    4,
  );
  return {
    ...params,
    text,
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
      (params.templateId === 'name-keychain' || params.templateId === 'plant-label')
        ? clamp(params.bubbleLobeMm ?? 0, 0, 4)
        : 0,
    tagTailMm:
      params.styleId === 'soft-tag' &&
      (params.templateId === 'name-keychain' || params.templateId === 'plant-label')
        ? clamp(params.tagTailMm ?? 0, 0, 4)
        : 0,
    archCurveMm:
      params.styleId === 'arch' &&
      (params.templateId === 'name-keychain' || params.templateId === 'plant-label')
        ? clamp(params.archCurveMm ?? 0, 0, 6)
        : 0,
    stakeShoulderMm:
      params.templateId === 'plant-label' ? clamp(params.stakeShoulderMm ?? 0, 0, 8) : 0,
    jointBossMm:
      params.templateId === 'articulated-name' ? clamp(params.jointBossMm ?? 0, 0, 3) : 0,
  };
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
