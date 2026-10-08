import { describe, expect, it } from 'vitest';
import process from 'node:process';
import { classifyChangedFiles, createGatePlan } from './validation-plan.mjs';

describe('validation gate selection', () => {
  it('runs only changed formatting for documentation', () => {
    expect(createGatePlan(['docs/seo.md', 'README.md']).map(({ id }) => id)).toEqual([
      'format:changed',
    ]);
  });

  it('selects UI gates and the browser smoke against a fresh build', () => {
    const plan = createGatePlan(['src/features/customizer/components/Editor.tsx']);
    expect(plan.map(({ id }) => id)).toEqual([
      'format:changed',
      'lint:changed',
      'typecheck',
      'unit:fast',
      'build',
      'browser',
    ]);
    expect(plan.find(({ id }) => id === 'browser').dependsOn).toEqual(['build']);
  });

  it('typechecks UI stylesheet changes because they can affect component contracts', () => {
    const plan = createGatePlan([
      'src/features/customizer/components/ControlsPanel/ControlsPanel.module.css',
    ]);
    expect(plan.map(({ id }) => id)).toContain('typecheck');
    expect(plan.map(({ id }) => id)).toContain('browser');
  });

  it('includes browser coverage and typecheck for shared telemetry styles', () => {
    const classification = classifyChangedFiles([
      'src/infrastructure/telemetry/TelemetryProvider/TelemetryProvider.module.css',
    ]);
    expect(classification.needsTypecheck).toBe(true);
    expect(classification.needsBrowser).toBe(true);
  });

  it('uses conservative full validation for tooling and lock changes', () => {
    expect(createGatePlan(['pnpm-lock.yaml']).map(({ id }) => id)).toEqual([
      'format',
      'lint',
      'typecheck',
      'unit',
      'build',
      'browser',
      'geometry',
    ]);
  });

  it('includes geometry and export contracts for WASM, fonts, exports and deleted paths', () => {
    for (const file of [
      'public/manifold.wasm',
      'public/fonts/latin.woff2',
      'src/infrastructure/export/serializer.ts',
      'src/infrastructure/export/removed.ts',
    ]) {
      const classification = classifyChangedFiles([file]);
      expect(classification.needsGeometry || classification.needsExport).toBe(true);
      expect(createGatePlan([file]).some(({ id }) => id === 'geometry')).toBe(true);
    }
  });

  it('classifies reorganized script paths by their responsibility', () => {
    expect(
      createGatePlan(['scripts/geometry/matrix/bench-matrix.ts']).map(({ id }) => id),
    ).toContain('geometry');
    expect(
      createGatePlan(['scripts/generators/generate-seo-sitemap.ts']).map(({ id }) => id),
    ).toContain('build');
    expect(
      createGatePlan(['scripts/validation/core/validation-plan.mjs']).map(({ id }) => id),
    ).toEqual(['format', 'lint', 'typecheck', 'unit', 'build', 'browser', 'geometry']);
  });

  it('runs full required checks in CI and lets the workflow add conditional gates', () => {
    expect(createGatePlan([], 'ci').map(({ id }) => id)).toEqual([
      'format',
      'lint',
      'typecheck',
      'unit',
      'build',
    ]);
    expect(createGatePlan([], 'ci-browser').map(({ id }) => id)).toEqual(['browser']);
    expect(createGatePlan([], 'ci-geometry').map(({ id }) => id)).toEqual(['geometry']);
  });

  it('passes geometry workers through while respecting the shared process budget', () => {
    const previousMatrix = process.env.MATRIX_CONCURRENCY;
    const previousValidation = process.env.VALIDATION_CONCURRENCY;
    process.env.MATRIX_CONCURRENCY = '4';
    process.env.VALIDATION_CONCURRENCY = '4';
    try {
      const [geometry] = createGatePlan([], 'ci-geometry');
      expect(geometry.workerSlots).toBe(4);
      expect(geometry.env.MATRIX_CONCURRENCY).toBe('4');
      process.env.VALIDATION_CONCURRENCY = '2';
      const [boundedGeometry] = createGatePlan([], 'ci-geometry');
      expect(boundedGeometry.workerSlots).toBe(2);
      expect(boundedGeometry.env.MATRIX_CONCURRENCY).toBe('2');
    } finally {
      if (previousMatrix === undefined) delete process.env.MATRIX_CONCURRENCY;
      else process.env.MATRIX_CONCURRENCY = previousMatrix;
      if (previousValidation === undefined) delete process.env.VALIDATION_CONCURRENCY;
      else process.env.VALIDATION_CONCURRENCY = previousValidation;
    }
  });

  it('rejects invalid geometry worker limits before scheduling any gate', () => {
    const previousMatrix = process.env.MATRIX_CONCURRENCY;
    process.env.MATRIX_CONCURRENCY = 'not-a-number';
    try {
      expect(() => createGatePlan([], 'ci-geometry')).toThrow('MATRIX_CONCURRENCY');
    } finally {
      if (previousMatrix === undefined) delete process.env.MATRIX_CONCURRENCY;
      else process.env.MATRIX_CONCURRENCY = previousMatrix;
    }
  });
});
