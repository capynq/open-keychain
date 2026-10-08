import { describe, expect, it } from 'vitest';
import process from 'node:process';
import {
  classifyChangedFiles,
  createGatePlan,
  requiresFullCIRegression,
} from './validation-plan.mjs';

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
    expect(plan.find(({ id }) => id === 'browser').required).toBe(true);
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
    const plan = createGatePlan(['pnpm-lock.yaml']);
    expect(plan.map(({ id }) => id)).toEqual([
      'format',
      'lint',
      'typecheck',
      'unit:fast',
      'build',
      'browser',
    ]);
    expect(plan.find(({ id }) => id === 'unit:fast').args).toEqual([
      'test:fast',
      '--',
      '--maxWorkers=2',
    ]);
    expect(plan.find(({ id }) => id === 'browser').args).toEqual(['test:e2e:smoke']);
    expect(plan.some(({ id }) => id === 'geometry')).toBe(false);
  });

  it('runs the whole fast unit suite even when only a test file changed', () => {
    const plan = createGatePlan(['src/features/customizer/hooks/useQuickSetup.test.ts']);
    expect(plan.find(({ id }) => id === 'unit:fast').args).toEqual([
      'test:fast',
      '--',
      '--maxWorkers=2',
    ]);
    expect(plan.some(({ id }) => id === 'geometry')).toBe(false);
    expect(plan.find(({ id }) => id === 'browser').dependsOn).toEqual(['build']);
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
      const plan = createGatePlan([file]);
      expect(plan.some(({ id }) => id === 'unit:fast')).toBe(true);
      expect(plan.some(({ id }) => id === 'browser')).toBe(true);
      expect(plan.some(({ id }) => id === 'geometry')).toBe(false);
    }
  });

  it('classifies reorganized script paths by their responsibility', () => {
    expect(
      createGatePlan(['scripts/geometry/matrix/bench-matrix.ts']).map(({ id }) => id),
    ).not.toContain('geometry');
    expect(
      createGatePlan(['scripts/generators/generate-seo-sitemap.ts']).map(({ id }) => id),
    ).toContain('build');
    expect(
      createGatePlan(['scripts/validation/core/validation-plan.mjs']).map(({ id }) => id),
    ).toEqual(['format', 'lint', 'typecheck', 'unit:fast', 'build', 'browser']);
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
    expect(createGatePlan([], 'ci-browser')[0].args).toEqual(['test:e2e:full']);
    expect(createGatePlan([], 'ci-browser')[0].env).toMatchObject({
      PLAYWRIGHT_USE_EXISTING_BUILD: 'true',
      VITE_HOSTED_MODE: 'false',
      PLAYWRIGHT_SMOKE: 'false',
    });
    expect(createGatePlan([], 'ci-geometry').map(({ id }) => id)).toEqual(['geometry']);
  });

  it('keeps the explicit local geometry benchmark available', () => {
    expect(createGatePlan([], 'bench-geometry').map(({ id }) => id)).toEqual(['geometry']);
  });

  it('requires complete browser and geometry regression gates for code changes in CI', () => {
    expect(requiresFullCIRegression(['docs/seo.md'])).toBe(false);
    expect(requiresFullCIRegression(['src/features/customizer/Editor.tsx'])).toBe(true);
    expect(requiresFullCIRegression(['e2e/customizer.spec.ts'])).toBe(true);
    expect(requiresFullCIRegression([], true)).toBe(true);
    expect(requiresFullCIRegression([])).toBe(false);
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
