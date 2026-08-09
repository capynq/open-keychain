export type StyleId = 'contour' | 'capsule' | 'soft-tag' | 'bubble' | 'arch' | 'frame';

export type KeychainParams = {
  text: string;
  fontId: string;
  styleId: StyleId;
  textHeightMm: number;
  baseThicknessMm: number;
  reliefDepthMm: number;
  paddingMm: number;
  holeDiameterMm: number;
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

export type GeometryResult = {
  generationId: number;
  baseMesh: MeshBuffer;
  reliefMesh: MeshBuffer;
  dimensions: Dimensions;
  issues: ValidationIssue[];
  printable: boolean;
};

export type WorkerRequest =
  | { type: 'generate'; requestId: number; params: KeychainParams }
  | { type: 'export'; requestId: number; params: KeychainParams; format?: ExportFormat; mode?: ThreeMfMode };

export type WorkerResponse =
  | { type: 'geometry'; requestId: number; result: Omit<GeometryResult, 'generationId'> }
  | { type: 'export'; requestId: number; filename: string; mimeType: string; data: ArrayBuffer }
  | { type: 'error'; requestId: number; message: string };

export const DEFAULT_PARAMS: KeychainParams = {
  text: 'ALEX',
  fontId: 'nunito',
  styleId: 'contour',
  textHeightMm: 20,
  baseThicknessMm: 2.4,
  reliefDepthMm: 1,
  paddingMm: 2.4,
  holeDiameterMm: 5,
};

export function normalizeParams(params: KeychainParams): NormalizedParams {
  const text = params.text.normalize('NFC').trim().replace(/\s+/g, ' ');
  return {
    ...params,
    text,
    textHeightMm: clamp(params.textHeightMm, 12, 30),
    baseThicknessMm: clamp(params.baseThicknessMm, 1.6, 4),
    reliefDepthMm: clamp(params.reliefDepthMm, 0.6, 2),
    paddingMm: clamp(params.paddingMm, 1.2, 5),
    holeDiameterMm: clamp(params.holeDiameterMm, 3, 7),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ringWallMm(holeDiameterMm: number): number {
  return Math.max(2.2, Math.min(3.5, holeDiameterMm * 0.46));
}

export function keyringMetrics(holeDiameterMm: number): KeyringMetrics {
  const wallMm = ringWallMm(holeDiameterMm);
  return {
    wallMm,
    outerRadiusMm: holeDiameterMm / 2 + wallMm,
    rootWidthMm: Math.max(6, wallMm * 2.5),
    overlapMm: Math.max(5, wallMm * 2),
  };
}

export function sanitizeFilename(text: string, styleId: string, extension: ExportFormat = 'stl'): string {
  const slug =
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48) || 'name';
  return `keychain-${slug}-${styleId}.${extension}`;
}
