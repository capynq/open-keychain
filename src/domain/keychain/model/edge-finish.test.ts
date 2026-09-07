import { describe, expect, it } from 'vitest';

import { canonicalEdgeMm, edgeFinishPreset, normalizeEdgeFinish } from './edge-finish';
import { DEFAULT_PARAMS, normalizeParams } from './types';

describe('edge finish contract', () => {
  it('snaps values to the printer grid and safely handles invalid values', () => {
    expect(canonicalEdgeMm(0.31, 2)).toBe(0.4);
    expect(canonicalEdgeMm(Number.NaN, 2)).toBe(0);
    expect(canonicalEdgeMm(Number.POSITIVE_INFINITY, 2)).toBe(0);
    expect(canonicalEdgeMm(-1, 2)).toBe(0);
  });

  it('uses visible defaults when a non-sharp profile is selected', () => {
    expect(edgeFinishPreset('round')).toEqual({
      style: 'round',
      topMm: 0.6,
      bottomMm: 0.4,
      textMm: 0,
    });
    expect(edgeFinishPreset('sharp')).toEqual({ style: 'sharp', topMm: 0, bottomMm: 0, textMm: 0 });
  });

  it('canonicalizes legacy and template-specific combinations', () => {
    const base = { ...DEFAULT_PARAMS, edgeFinish: 'round' as const, topEdgeMm: 2, bottomEdgeMm: 2 };
    const normalized = normalizeParams(base);
    expect(normalized.topEdgeMm! + normalized.bottomEdgeMm!).toBeLessThanOrEqual(
      normalized.baseThicknessMm - normalized.minimumWallMm,
    );
    expect(normalizeParams({ ...base, edgeFinish: 'sharp' }).topEdgeMm).toBe(0);
    expect(normalizeParams({ ...base, templateId: 'nameplate', textEdgeMm: 0.8 }).textEdgeMm).toBe(
      0,
    );
    expect(normalizeParams({ ...base, templateId: 'articulated-name' }).edgeFinish).toBe('sharp');
  });

  it('leaves a 0.2 mm relief cap below a text finish', () => {
    const finish = normalizeEdgeFinish({
      ...DEFAULT_PARAMS,
      edgeFinish: 'round',
      reliefDepthMm: 1,
      textEdgeMm: 1,
    });
    expect(finish.textMm).toBe(0.8);
  });
});
