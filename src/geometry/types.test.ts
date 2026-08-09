import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, keyringMetrics, normalizeParams, ringWallMm, sanitizeFilename } from './types';

describe('keychain parameters', () => {
  it('normalizes text and clamps consumer controls', () => {
    const result = normalizeParams({ ...DEFAULT_PARAMS, text: '  José   ', textHeightMm: 100, holeDiameterMm: 0 });
    expect(result.text).toBe('José');
    expect(result.textHeightMm).toBe(30);
    expect(result.holeDiameterMm).toBe(3);
  });

  it('derives a printable ring wall', () => {
    expect(ringWallMm(3)).toBe(2.2);
    expect(ringWallMm(7)).toBeCloseTo(3.22);
    const metrics = keyringMetrics(5);
    expect(metrics.wallMm).toBeCloseTo(2.3);
    expect(metrics.outerRadiusMm).toBeCloseTo(4.8);
    expect(metrics.rootWidthMm).toBe(6);
    expect(metrics.overlapMm).toBe(5);
  });

  it('creates safe friendly filenames', () => {
    expect(sanitizeFilename('Émilie & Jo', 'soft-tag')).toBe('keychain-emilie-jo-soft-tag.stl');
    expect(sanitizeFilename('   ', 'contour')).toBe('keychain-name-contour.stl');
  });
});
