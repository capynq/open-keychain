import { describe, expect, it } from 'vitest';

import type { GeometryResult } from './types';

import {
  formatAcceptedMaximum,
  formatAcceptedSize,
  selectAcceptedMetrics,
} from './accepted-metrics';

const result = (overrides: Partial<GeometryResult> = {}): GeometryResult => ({
  generationId: 3,
  baseMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  reliefMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  dimensions: { widthMm: 54.2, heightMm: 23.8, thicknessMm: 3.4, centerMm: [0, 0, 0] },
  issues: [],
  printable: true,
  appearance: {
    base: { name: 'Base', color: '#111111' },
    relief: { name: 'Relief', color: '#eeeeee' },
  },
  solidCount: 2,
  ...overrides,
});

describe('accepted metrics', () => {
  it('uses accepted geometry and reports the selected maximum independently', () => {
    expect(selectAcceptedMetrics(result(), { widthMm: 60, heightMm: 25 })).toEqual({
      widthMm: 54.2,
      heightMm: 23.8,
      thicknessMm: 3.4,
      parts: 2,
      maximum: { widthMm: 60, heightMm: 25 },
      fitsWithinMaximum: true,
    });
  });

  it('does not fabricate metrics without an accepted result', () => {
    expect(selectAcceptedMetrics(undefined, { widthMm: 60, heightMm: 25 })).toBeUndefined();
  });
  it('does not confuse material volumes with printable bodies', () => {
    const uncounted = result({ solidCount: undefined });
    uncounted.parts = [
      { id: 'base', name: 'Base', role: 'base', mesh: uncounted.baseMesh },
      { id: 'relief', name: 'Relief', role: 'relief', mesh: uncounted.reliefMesh },
    ];
    expect(selectAcceptedMetrics(uncounted, undefined)?.parts).toBeUndefined();
  });
  it('uses geometry fit tolerance and keeps custom maximum precision', () => {
    const metrics = selectAcceptedMetrics(result(), { widthMm: 54.15, heightMm: 23.75 })!;
    expect(metrics.fitsWithinMaximum).toBe(true);
    expect(formatAcceptedMaximum(metrics)).toBe(formatAcceptedSize(metrics.maximum!));
    expect(formatAcceptedMaximum(metrics)).toBe('54.1 × 23.8 mm');
    expect(selectAcceptedMetrics(result(), { widthMm: 50, heightMm: 20 })?.fitsWithinMaximum).toBe(
      false,
    );
  });
  it('does not present empty or non-finite geometry as a model measurement', () => {
    for (const widthMm of [0, -1, NaN, Infinity]) {
      expect(
        selectAcceptedMetrics(
          result({ dimensions: { widthMm, heightMm: 20, thicknessMm: 3, centerMm: [0, 0, 0] } }),
          undefined,
        ),
      ).toBeUndefined();
    }
  });
});
