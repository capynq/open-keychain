import { describe, expect, it } from 'vitest';
import { templateParameterKeys } from './parameters';
import { DEFAULT_PARAMS, keyringMetrics, normalizeParams, ringWallMm, sanitizeFilename } from './types';

describe('keychain parameters', () => {
  it('normalizes text and clamps consumer controls', () => {
    const result = normalizeParams({ ...DEFAULT_PARAMS, text: '  José   ', textHeightMm: 100, holeDiameterMm: 0 });
    expect(result.text).toBe('José');
    expect(result.textHeightMm).toBe(30);
    expect(result.holeDiameterMm).toBe(3);
    expect(result.letterSpacingMm).toBe(1);
    expect(normalizeParams({ ...DEFAULT_PARAMS, nameplateTiltDeg: 90 }).nameplateTiltDeg).toBe(45);
  });

  it('exposes only controls that affect each template', () => {
    expect(templateParameterKeys('plant-label')).not.toContain('holeDiameterMm');
    expect(templateParameterKeys('articulated-name')).not.toContain('letterSpacingMm');
    expect(templateParameterKeys('articulated-name')).not.toContain('paddingMm');
    expect(templateParameterKeys('nameplate')).toContain('cornerRadiusMm');
    expect(templateParameterKeys('nameplate')).toContain('nameplateTiltDeg');
    expect(templateParameterKeys('nameplate')).toContain('nameplateEmbedMm');
    expect(templateParameterKeys('nameplate')).not.toContain('holeDiameterMm');
    expect(templateParameterKeys('nameplate')).toContain('reliefDepthMm');
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
