import { describe, expect, it } from 'vitest';

import type { GeometryResult } from '../../../domain/keychain/model/types';

import { buildPreflightReport } from './preflight';

const result = (overrides: Partial<GeometryResult> = {}): GeometryResult => ({
  generationId: 1,
  baseMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  reliefMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  dimensions: { widthMm: 40, heightMm: 20, thicknessMm: 3, centerMm: [0, 0, 0] },
  issues: [],
  printable: true,
  appearance: {
    base: { name: 'Base', color: '#111111' },
    relief: { name: 'Relief', color: '#EEEEEE' },
  },
  ...overrides,
});

describe('export preflight', () => {
  it('reports generating without geometry', () =>
    expect(buildPreflightReport(undefined).status).toBe('generating'));
  it('does not expose stale geometry while regenerating', () => {
    const report = buildPreflightReport(result(), result().appearance, true);

    expect(report.status).toBe('generating');
    expect(report.dimensions).toBeUndefined();
  });
  it('blocks a generation error without stale geometry', () => {
    const report = buildPreflightReport(result(), result().appearance, false, 'worker failed');

    expect(report.status).toBe('blocked');
    expect(report.dimensions).toBeUndefined();
  });
  it('blocks errors', () =>
    expect(
      buildPreflightReport(
        result({ printable: false, issues: [{ severity: 'error', code: 'bad', message: 'bad' }] }),
      ).status,
    ).toBe('blocked'));
  it('keeps warnings exportable', () => {
    const report = buildPreflightReport(
      result({ issues: [{ severity: 'warning', code: 'warn', message: 'warn' }] }),
    );

    expect(report.status).toBe('ready-with-warnings');
    expect(report.printable).toBe(true);
  });
  it('reports clean geometry ready', () =>
    expect(buildPreflightReport(result()).status).toBe('ready'));
});
