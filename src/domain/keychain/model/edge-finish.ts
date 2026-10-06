import type { EdgeFinish, KeychainParams } from './types';

/** The smallest edge feature that is reliably visible on the standard printer. */
export const EDGE_FINISH_GRID_MM = 0.2;
export const EDGE_FINISH_TEXT_CLEARANCE_MM = 0.2;

export type EdgeFinishValues = {
  style: EdgeFinish;
  topMm: number;
  bottomMm: number;
  textStyle: EdgeFinish;
  textMm: number;
};

const finiteOrZero = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Clamp and snap a public edge value to the printer-visible 0.2 mm grid. */
export const canonicalEdgeMm = (value: number | undefined, maximum: number): number => {
  const clamped = Math.min(maximum, Math.max(0, finiteOrZero(value)));
  return Math.min(maximum, Math.round(clamped / EDGE_FINISH_GRID_MM) * EDGE_FINISH_GRID_MM);
};

/**
 * Resolve the persisted finish controls into the one contract consumed by builders.
 * Legacy values remain readable, while unsupported template combinations become sharp.
 */
export const normalizeEdgeFinish = (
  params: Pick<
    KeychainParams,
    'edgeFinish' | 'topEdgeMm' | 'bottomEdgeMm' | 'textEdgeMm' | 'textEdgeFinish' | 'reliefDepthMm'
  >,
): EdgeFinishValues => {
  const style: EdgeFinish = ['sharp', 'chamfer', 'round'].includes(params.edgeFinish ?? '')
    ? params.edgeFinish!
    : 'sharp';
  const topMm = style === 'sharp' ? 0 : canonicalEdgeMm(params.topEdgeMm, 2);
  const bottomMm = style === 'sharp' ? 0 : canonicalEdgeMm(params.bottomEdgeMm, 2);
  const textStyle: EdgeFinish = ['sharp', 'chamfer', 'round'].includes(params.textEdgeFinish ?? '')
    ? params.textEdgeFinish!
    : 'sharp';
  return {
    style,
    topMm,
    bottomMm,
    textStyle,
    textMm:
      textStyle === 'sharp'
        ? 0
        : canonicalEdgeMm(
            params.textEdgeMm,
            Math.max(0, finiteOrZero(params.reliefDepthMm) - EDGE_FINISH_TEXT_CLEARANCE_MM),
          ),
  };
};
