import type { EdgeFinish, KeychainParams } from './types';

/** The smallest edge feature that is reliably visible on the standard printer. */
export const EDGE_FINISH_GRID_MM = 0.2;
export const EDGE_FINISH_TEXT_CLEARANCE_MM = 0.2;

export type EdgeFinishValues = {
  style: EdgeFinish;
  topMm: number;
  bottomMm: number;
  textMm: number;
};

const finiteOrZero = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Clamp and snap a public edge value to the printer-visible 0.2 mm grid. */
export const canonicalEdgeMm = (value: number | undefined, maximum: number): number => {
  const clamped = Math.min(maximum, Math.max(0, finiteOrZero(value)));
  return Math.min(maximum, Math.round(clamped / EDGE_FINISH_GRID_MM) * EDGE_FINISH_GRID_MM);
};

/** Defaults used when a non-sharp profile is selected before fine tuning. */
export const edgeFinishPreset = (style: EdgeFinish): EdgeFinishValues =>
  style === 'sharp'
    ? { style, topMm: 0, bottomMm: 0, textMm: 0 }
    : { style, topMm: 0.6, bottomMm: 0.4, textMm: 0 };

/**
 * Resolve the persisted finish controls into the one contract consumed by builders.
 * Legacy values remain readable, while unsupported template combinations become sharp.
 */
export const normalizeEdgeFinish = (
  params: Pick<
    KeychainParams,
    | 'templateId'
    | 'edgeFinish'
    | 'topEdgeMm'
    | 'bottomEdgeMm'
    | 'textEdgeMm'
    | 'baseThicknessMm'
    | 'minimumWallMm'
    | 'reliefDepthMm'
  >,
): EdgeFinishValues => {
  const style: EdgeFinish = ['sharp', 'chamfer', 'round'].includes(params.edgeFinish ?? '')
    ? params.edgeFinish!
    : 'sharp';
  if (style === 'sharp' || params.templateId === 'articulated-name')
    return { style: 'sharp', topMm: 0, bottomMm: 0, textMm: 0 };

  const topMm = canonicalEdgeMm(params.topEdgeMm, 2);
  const availableMm = Math.max(
    0,
    Math.floor(
      (finiteOrZero(params.baseThicknessMm) - finiteOrZero(params.minimumWallMm)) /
        EDGE_FINISH_GRID_MM,
    ) * EDGE_FINISH_GRID_MM,
  );
  const canonicalTop = Math.min(topMm, availableMm);
  const bottomMm = Math.min(canonicalEdgeMm(params.bottomEdgeMm, 2), availableMm - canonicalTop);
  return {
    style,
    topMm: canonicalTop,
    bottomMm,
    // Nameplates have a standalone finish and must not round their relief text.
    textMm:
      params.templateId === 'nameplate'
        ? 0
        : canonicalEdgeMm(
            params.textEdgeMm,
            Math.max(0, finiteOrZero(params.reliefDepthMm) - EDGE_FINISH_TEXT_CLEARANCE_MM),
          ),
  };
};
