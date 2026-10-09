import { describe, expect, it } from 'vitest';
import process from 'node:process';
import {
  classifyChangedFiles,
  createCiChangedGatePlan,
  createGatePlan,
  requiresFullCIRegression,
} from './validation-plan.mjs';

describe('validation gate selection', () => {
  it('selects only formatting for documentation and focused tests/build for geometry', () => {
    expect(createCiChangedGatePlan(['docs/geometry-roadmap.md']).map(({ id }) => id)).toEqual([
      'format:changed',
    ]);
    const geometry = createCiChangedGatePlan(['src/domain/keychain/build/keychain-builder.ts']);
    expect(geometry.map(({ id }) => id)).toContain('unit:related');
    expect(geometry.map(({ id }) => id)).toContain('typecheck');
    expect(geometry.map(({ id }) => id)).toContain('build');
    expect(geometry.map(({ id }) => id)).not.toContain('browser');
    expect(geometry.map(({ id }) => id)).not.toContain('geometry');
    expect(geometry.find(({ id }) => id === 'unit:related').args).toContain(
      'src/domain/keychain/build/keychain-builder.keyring-articulated.test.ts',
    );
  });

  it('selects UI smoke, direct changed Playwright specs, and changed unit tests', () => {
    const ui = createCiChangedGatePlan([
      'src/features/customizer/components/ControlsPanel/ControlsPanel.tsx',
    ]);
    expect(ui.map(({ id }) => id)).toEqual([
      'format:changed',
      'lint:changed',
      'typecheck',
      'unit:related',
      'build',
      'browser',
    ]);
    const browserSpec = createCiChangedGatePlan(['e2e/smoke.spec.ts']);
    expect(browserSpec.map(({ id }) => id)).toEqual([
      'format:changed',
      'lint:changed',
      'browser:changed',
    ]);
    const mixedUiAndBrowser = createCiChangedGatePlan([
      'src/app/components/landing/TemplatePreviewCard/TemplatePreviewCard.tsx',
      'e2e/routes.spec.ts',
    ]);
    expect(mixedUiAndBrowser.map(({ id }) => id)).toContain('unit:related');
    expect(mixedUiAndBrowser.map(({ id }) => id)).toContain('browser:changed');
    expect(mixedUiAndBrowser.map(({ id }) => id)).toContain('browser');
    const relatedUnit = mixedUiAndBrowser.find(({ id }) => id === 'unit:related');
    expect(relatedUnit.args).not.toContain('e2e/routes.spec.ts');
    expect(mixedUiAndBrowser.find(({ id }) => id === 'browser:changed')).toMatchObject({
      dependsOn: ['build'],
      env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
    });
    const mixedTestOnly = createCiChangedGatePlan([
      'e2e/smoke.spec.ts',
      'scripts/validation/core/validation-plan.test.mjs',
    ]);
    expect(mixedTestOnly.map(({ id }) => id)).toEqual([
      'format:changed',
      'lint:changed',
      'unit:changed',
      'browser:changed',
    ]);
    const unit = createCiChangedGatePlan(['src/infrastructure/telemetry/telemetry-events.test.ts']);
    expect(unit.map(({ id }) => id)).toEqual(['format:changed', 'lint:changed', 'unit:changed']);
  });

  it('maps export, bundled font, and WASM changes to their owning Unit coverage', () => {
    const cases = [
      [
        'src/infrastructure/export/three-mf-serializer.ts',
        'src/infrastructure/export/three-mf-serializer.ts',
      ],
      [
        'src/domain/keychain/fonts/google-provider.ts',
        'src/domain/keychain/fonts/google-provider.test.ts',
      ],
      ['public/fonts/custom.woff2', 'src/domain/keychain/fonts/catalog.test.ts'],
      ['public/manifold.wasm', 'src/domain/keychain/build/keychain-builder.contracts.test.ts'],
    ];
    for (const [changed, ownerTest] of cases) {
      const plan = createCiChangedGatePlan([changed]);
      expect(plan.map(({ id }) => id)).toContain('unit:related');
      expect(plan.find(({ id }) => id === 'unit:related').args).toContain(ownerTest);
      expect(plan.map(({ id }) => id)).not.toContain('browser');
      expect(plan.map(({ id }) => id)).not.toContain('geometry');
    }
  });

  it('uses a cost-first fallback for unknown paths and keeps deleted/renamed paths classifiable', () => {
    expect(createCiChangedGatePlan(['unknown-area/config.toml']).map(({ id }) => id)).toEqual([
      'format',
      'lint',
      'typecheck',
      'build',
    ]);
    const deleted = createCiChangedGatePlan(['src/domain/keychain/build/removed-builder.ts']);
    expect(deleted.map(({ id }) => id)).toContain('typecheck');
    expect(deleted.map(({ id }) => id)).toContain('build');
    expect(createCiChangedGatePlan(['src/old.ts', 'src/new.ts']).map(({ id }) => id)).toContain(
      'typecheck',
    );
  });

  it('runs validation and workflow owner tests without unrelated typecheck/build gates', () => {
    for (const file of [
      'scripts/validation/core/validation-plan.mjs',
      '.github/workflows/ci.yml',
    ]) {
      const plan = createCiChangedGatePlan([file]);
      expect(plan.map(({ id }) => id)).toContain('unit:related');
      expect(plan.map(({ id }) => id)).not.toContain('typecheck');
      expect(plan.map(({ id }) => id)).not.toContain('build');
    }
  });

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
