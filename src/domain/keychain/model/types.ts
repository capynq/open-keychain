export type StyleId = 'contour' | 'capsule' | 'soft-tag' | 'bubble' | 'arch' | 'frame';
export type TemplateId = 'name-keychain' | 'articulated-name' | 'nameplate' | 'plant-label';
export type KeychainParams = {
  text: string;
  fontId: string;
  templateId: TemplateId;
  styleId: StyleId;
  textHeightMm: number;
  baseThicknessMm: number;
  reliefDepthMm: number;
  paddingMm: number;
  letterSpacingMm: number;
  holeDiameterMm: number;
  connectorWidthMm: number;
  cornerRadiusMm: number;
  stakeLengthMm: number;
  nameplateTiltDeg: number;
  nameplateEmbedMm: number;
  jointClearanceMm: number;
  mechanicalGapMm: number;
  maxJointAngleDeg: number;
  minimumWallMm: number;
  bottomClearanceMm: number;
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
  baseShading?: 'creased' | 'flat';
  solidCount?: number;
};
export type WorkerRequest =
  | {
      type: 'generate';
      requestId: number;
      params: KeychainParams;
    }
  | {
      type: 'export';
      requestId: number;
      params: KeychainParams;
      format?: ExportFormat;
      mode?: ThreeMfMode;
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
  textHeightMm: 20,
  baseThicknessMm: 2.4,
  reliefDepthMm: 1,
  paddingMm: 2.4,
  letterSpacingMm: 1,
  holeDiameterMm: 5,
  connectorWidthMm: 1.8,
  cornerRadiusMm: 4,
  stakeLengthMm: 48,
  nameplateTiltDeg: 6,
  nameplateEmbedMm: 0.4,
  jointClearanceMm: 0.35,
  mechanicalGapMm: 0.6,
  maxJointAngleDeg: 35,
  minimumWallMm: 1.2,
  bottomClearanceMm: 0.25,
};
export const normalizeParams = (params: KeychainParams): NormalizedParams => {
  const text = params.text.normalize('NFC').trim().replace(/\s+/g, ' ');
  return {
    ...params,
    text,
    templateId: params.templateId ?? 'name-keychain',
    textHeightMm: clamp(params.textHeightMm, 12, 30),
    baseThicknessMm: clamp(
      params.baseThicknessMm,
      params.templateId === 'articulated-name' ? 3.4 : 1.6,
      4,
    ),
    reliefDepthMm: clamp(params.reliefDepthMm, 0.6, 2),
    paddingMm: clamp(params.paddingMm, 1.2, 5),
    letterSpacingMm: clamp(params.letterSpacingMm ?? 1, 0, 8),
    holeDiameterMm: clamp(params.holeDiameterMm, 3, 7),
    connectorWidthMm: clamp(params.connectorWidthMm ?? 1.8, 1.4, 3),
    cornerRadiusMm: clamp(params.cornerRadiusMm ?? 4, 1.5, 12),
    stakeLengthMm: clamp(params.stakeLengthMm ?? 48, 24, 100),
    nameplateTiltDeg: clamp(params.nameplateTiltDeg ?? 6, 0, 45),
    nameplateEmbedMm: clamp(params.nameplateEmbedMm ?? 0.4, 0.2, 1.8),
    jointClearanceMm: clamp(params.jointClearanceMm ?? 0.35, 0.2, 0.8),
    mechanicalGapMm: clamp(params.mechanicalGapMm ?? 0.6, 0.4, 1.5),
    maxJointAngleDeg: clamp(params.maxJointAngleDeg ?? 35, 15, 50),
    minimumWallMm: clamp(params.minimumWallMm ?? 1.2, 0.8, 3),
    bottomClearanceMm: clamp(params.bottomClearanceMm ?? 0.25, 0.15, 0.6),
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
