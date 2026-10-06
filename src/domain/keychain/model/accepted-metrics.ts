import type { GeometryResult, SizeEnvelope } from './types';

export type AcceptedMetrics = {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  parts: number | undefined;
  maximum?: SizeEnvelope;
  fitsWithinMaximum?: boolean;
};

/** Derive display metrics only from the last accepted geometry and its accepted size envelope. */
export const selectAcceptedMetrics = (
  result: GeometryResult | undefined,
  sizeEnvelope: SizeEnvelope | undefined,
): AcceptedMetrics | undefined => {
  if (!result) return undefined;

  const { widthMm, heightMm, thicknessMm } = result.dimensions;
  if (![widthMm, heightMm, thicknessMm].every((value) => Number.isFinite(value) && value > 0))
    return undefined;

  return {
    widthMm,
    heightMm,
    thicknessMm,
    parts: result.solidCount,
    maximum: sizeEnvelope,
    fitsWithinMaximum: sizeEnvelope
      ? widthMm <= sizeEnvelope.widthMm + 0.1 && heightMm <= sizeEnvelope.heightMm + 0.1
      : undefined,
  };
};

export const formatAcceptedSize = (
  metrics: Pick<AcceptedMetrics, 'widthMm' | 'heightMm'>,
): string => `${metrics.widthMm.toFixed(1)} × ${metrics.heightMm.toFixed(1)} mm`;

export const formatAcceptedThickness = (metrics: AcceptedMetrics): string =>
  `${metrics.thicknessMm.toFixed(1)} mm`;

export const formatAcceptedMaximum = (metrics: AcceptedMetrics): string | undefined =>
  metrics.maximum ? formatAcceptedSize(metrics.maximum) : undefined;
