import process from 'node:process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { FORMAT_EXTENSIONS, LINT_EXTENSIONS, extensionOf } from './file-types.mjs';
import { isGeometryInput } from './inputs.mjs';
import { boundedConcurrency, unitWorkerCount, validationConcurrency } from './concurrency.mjs';
const ASSET_EXTENSIONS = /\.(?:ttf|otf|woff2?|eot|wasm|png|jpe?g|webp|svg|ico)$/i;
const SOURCE_ROOTS = ['src/', 'e2e/', 'scripts/', 'public/', 'tools/'];

const CONSERVATIVE_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'vitest.config.ts',
  'playwright.config.ts',
  'playwright.dev-boot.config.ts',
  'playwright.capture.config.ts',
  'playwright.deployment.config.ts',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'eslint.config.js',
  'prettier.config.js',
  '.npmrc',
  '.gitignore',
  '.nvmrc',
  '.node-version',
  'scripts/validation/core/validation-plan.mjs',
  'scripts/validation/commands/run-validation-gates.mjs',
  'scripts/validation/core/validation-cache.mjs',
  'scripts/validation/reporters/validation-ui.mjs',
]);

const normalize = (file) => file.replaceAll('\\', '/').replace(/^\.\//, '');
const MAX_MATRIX_CONCURRENCY = 8;
const matrixWorkerCount = () =>
  Math.min(
    boundedConcurrency('MATRIX_CONCURRENCY', validationConcurrency(), MAX_MATRIX_CONCURRENCY),
    validationConcurrency(),
  );
const browserRegressionGate = () => ({
  id: 'browser:regression',
  name: 'Browser regression',
  required: true,
  workerSlots: 2,
  command: 'pnpm',
  args: ['test:e2e:regression'],
  env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true', PLAYWRIGHT_SMOKE: 'false' },
  dependsOn: ['build'],
});
const unitGate = (id, script) => {
  const workers = id === 'unit' ? Math.max(2, validationConcurrency()) : unitWorkerCount();
  return {
    id,
    name: 'Unit',
    required: true,
    workerSlots: workers,
    command: 'pnpm',
    args: [script, '--', `--maxWorkers=${workers}`],
  };
};
const isTest = (file) => /\.(?:test|spec)\.[^.]+$/i.test(file);
const isDocumentation = (file) =>
  !file.startsWith('src/') &&
  !file.startsWith('public/') &&
  (file.startsWith('docs/') ||
    file === 'CONTRIBUTING.md' ||
    file === 'README' ||
    file.startsWith('README.') ||
    ['.md', '.mdx', '.txt'].includes(extensionOf(file)));

const isGeometry = (file) => isGeometryInput(file) || /\.(?:ttf|otf|woff2?|eot|wasm)$/i.test(file);

const isBrowser = (file) => {
  if (isTest(file) && file.startsWith('src/')) return false;
  return (
    file.startsWith('e2e/') ||
    file.startsWith('public/') ||
    file.startsWith('src/app/') ||
    file.startsWith('src/components/') ||
    file.startsWith('src/features/') ||
    file.startsWith('src/pages/') ||
    file.startsWith('src/widgets/') ||
    file.startsWith('src/shared/') ||
    file.startsWith('src/infrastructure/export/') ||
    file.startsWith('src/infrastructure/i18n/') ||
    file.startsWith('src/infrastructure/seo/') ||
    file.startsWith('src/infrastructure/telemetry/') ||
    file.startsWith('src/main') ||
    file === 'index.html' ||
    file.startsWith('playwright.') ||
    file.startsWith('playwright-')
  );
};

const isBuildInput = (file) =>
  file === 'index.html' ||
  (file.startsWith('src/') && !isTest(file)) ||
  file.startsWith('public/') ||
  file.startsWith('assets/') ||
  file.startsWith('scripts/build/') ||
  file.startsWith('scripts/generators/') ||
  ['vite.config.ts', 'netlify.toml', 'postcss.config.js'].includes(file);

const isConservative = (file) =>
  CONSERVATIVE_FILES.has(file) ||
  file.startsWith('.github/workflows/') ||
  file.startsWith('.husky/') ||
  file.startsWith('scripts/validation/') ||
  file.startsWith('scripts/build/');
const isUnclassified = (file) =>
  !isDocumentation(file) &&
  !SOURCE_ROOTS.some((root) => file.startsWith(root)) &&
  !file.startsWith('src/') &&
  !file.startsWith('assets/') &&
  ![
    'index.html',
    'package.json',
    'pnpm-lock.yaml',
    'netlify.toml',
    'postcss.config.js',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    'playwright.dev-boot.config.ts',
    'playwright.capture.config.ts',
    'playwright.deployment.config.ts',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'eslint.config.js',
    'prettier.config.js',
  ].includes(file) &&
  !file.startsWith('.github/') &&
  !file.startsWith('.husky/');

export const classifyChangedFiles = (inputFiles) => {
  const files = [...new Set(inputFiles.map(normalize))].sort();
  const documentationOnly = files.length > 0 && files.every(isDocumentation);
  return {
    files,
    documentationOnly,
    needsFormat: files.some((file) => FORMAT_EXTENSIONS.has(extensionOf(file))),
    needsLint: files.some((file) => LINT_EXTENSIONS.has(extensionOf(file))),
    needsTypecheck: files.some(
      (file) =>
        (/\.(?:ts|tsx|mts|cts)$/i.test(file) &&
          (SOURCE_ROOTS.some((root) => file.startsWith(root)) || file.startsWith('src/'))) ||
        (/\.(?:css|scss)$/i.test(file) && file.startsWith('src/')),
    ),
    needsBuild: files.some(isBuildInput),
    needsBrowser: files.some(isBrowser),
    needsGeometry: files.some(isGeometry),
    needsExport: files.some((file) => file.startsWith('src/infrastructure/export/')),
    needsHosting: files.some((file) => file === 'netlify.toml' || file === 'public/_headers'),
    conservative: files.some((file) => isConservative(file) || isUnclassified(file)),
    hasAssetsOrDynamicInputs: files.some(
      (file) =>
        ASSET_EXTENSIONS.test(file) ||
        file.startsWith('public/') ||
        file.startsWith('src/infrastructure/geometry/') ||
        file.startsWith('src/domain/keychain/fonts/'),
    ),
    hasDeletedOrRenamedCandidate: false,
  };
};

export const requiresFullCIRegression = (inputFiles, conservative = false) => {
  const classification = classifyChangedFiles(inputFiles);
  return conservative || (classification.files.length > 0 && !classification.documentationOnly);
};

const BUILDER_DIRECTORY = 'src/domain/keychain/build';
export const keychainBuilderSuites = () =>
  existsSync(BUILDER_DIRECTORY)
    ? readdirSync(BUILDER_DIRECTORY)
        .filter((file) => /^keychain-builder\..+\.test\.ts$/.test(file))
        .sort()
        .map((file) => `${BUILDER_DIRECTORY}/${file}`)
    : [];

export const relatedInputsForCi = (files) => {
  const existing = files.filter((file) => existsSync(file));
  const dynamicMappings = new Map([
    ['src/domain/keychain/build/keychain-builder.ts', keychainBuilderSuites()],
    [
      'src/infrastructure/geometry/geometry-client.ts',
      ['src/infrastructure/geometry/geometry-client.test.ts'],
    ],
    [
      'src/infrastructure/geometry/geometry-worker.ts',
      ['src/infrastructure/geometry/geometry-client.test.ts'],
    ],
    ['public/manifold.wasm', ['src/domain/keychain/build/keychain-builder.contracts.test.ts']],
    ['public/manifold-v1.wasm', ['src/domain/keychain/build/keychain-builder.contracts.test.ts']],
    [
      'public/fonts/',
      [
        'src/domain/keychain/fonts/catalog.test.ts',
        'src/domain/keychain/fonts/google-provider.test.ts',
        'src/domain/keychain/fonts/local-provider.test.ts',
      ],
    ],
    [
      'src/domain/keychain/fonts/',
      [
        'src/domain/keychain/fonts/catalog.test.ts',
        'src/domain/keychain/fonts/google-provider.test.ts',
        'src/domain/keychain/fonts/local-provider.test.ts',
      ],
    ],
    [
      'scripts/validation/',
      [
        'scripts/validation/core/validation-plan.test.mjs',
        'scripts/validation/commands/validation-ci-workflow.test.mjs',
        'scripts/validation/core/runner.test.mjs',
      ],
    ],
    ['.github/workflows/', ['scripts/validation/commands/validation-ci-workflow.test.mjs']],
    ['.github/actions/', ['scripts/validation/commands/validation-ci-workflow.test.mjs']],
  ]);
  const mapped = files.flatMap((file) =>
    [...dynamicMappings].flatMap(([boundary, tests]) =>
      file === boundary || (boundary.endsWith('/') && file.startsWith(boundary)) ? tests : [],
    ),
  );
  return {
    sources: [
      ...new Set(existing.filter((file) => !isTest(file) && /\.(?:[cm]?[jt]sx?)$/i.test(file))),
    ],
    tests: [
      ...new Set([
        ...existing.filter((file) => isTest(file) && !file.startsWith('e2e/')),
        ...mapped,
      ]),
    ].filter(existsSync),
    browserSpecs: existing.filter((file) => isTest(file) && file.startsWith('e2e/')),
  };
};

/*
 * Hosted CI runs selected gates in three parallel jobs. Build belongs with the browser gates that
 * reuse its artifact; every other gate is independent of the others.
 */
export const CI_GATE_GROUPS = ['static', 'unit', 'browser'];
export const ciGateGroup = ({ id }) =>
  id.startsWith('unit')
    ? 'unit'
    : id === 'build' || id.startsWith('browser')
      ? 'browser'
      : 'static';

/* Changed specs run on desktop and mobile; mobile-2x only adds a different pixel ratio. */
export const CI_CHANGED_SPEC_PROJECTS = ['desktop', 'mobile'];
const PIXEL_RATIO_SENSITIVE =
  /project\.name\s*===\s*'mobile-2x'|devicePixelRatio|deviceScaleFactor/;
export const isPixelRatioSensitiveSpec = (spec) => {
  try {
    return PIXEL_RATIO_SENSITIVE.test(readFileSync(spec, 'utf8'));
  } catch {
    return false;
  }
};

/* Browser builds use test keys; PostHog points at an unroutable host that feedback specs intercept. */
export const E2E_BUILD_ENV = Object.freeze({
  VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key',
  VITE_POSTHOG_KEY: 'phc_playwright',
  VITE_POSTHOG_HOST: 'https://posthog.test',
});

const createBuildGate = () => ({
  id: 'build',
  name: 'Build',
  required: true,
  phase: 'Vite production artifact',
  command: 'pnpm',
  args: ['build:artifact'],
  env: E2E_BUILD_ENV,
});

const appendJourneyGate = (gates) => {
  if (!gates.some(({ id }) => id === 'build')) gates.push(createBuildGate());
  if (!gates.some(({ id }) => id === 'browser:journey'))
    gates.push({
      id: 'browser:journey',
      name: 'Critical user journey',
      required: true,
      cacheable: false,
      verificationRequired: true,
      workerSlots: 1,
      command: 'pnpm',
      args: ['test:e2e:journey'],
      env: {
        PLAYWRIGHT_BASE_URL: '',
        PLAYWRIGHT_USE_EXISTING_BUILD: 'true',
        PLAYWRIGHT_SMOKE: 'false',
        VITE_HOSTED_MODE: 'false',
        PLAYWRIGHT_DEPLOYMENT: 'false',
      },
      dependsOn: ['build'],
    });
  return gates;
};

export const createCiChangedGatePlan = (inputFiles) => {
  const {
    files,
    documentationOnly,
    needsFormat,
    needsLint,
    needsTypecheck,
    needsBuild,
    needsBrowser,
    needsGeometry,
    conservative,
  } = classifyChangedFiles(inputFiles);
  const normalized = files.map(normalize);
  const testOnly = normalized.every(isTest);
  const unknown = normalized.some(isUnclassified);
  const toolingOnly = normalized.every(
    (file) => file.startsWith('scripts/validation/') || file.startsWith('.github/workflows/'),
  );
  const gates = [];
  const add = (id, name, args, options = {}) =>
    gates.push({ id, name, required: true, command: 'pnpm', args, ...options });
  if (unknown) {
    add('format', 'Format', ['format:check']);
    add('lint', 'Lint', ['lint']);
  } else if (needsFormat)
    add('format:changed', 'Format', ['validate:changed', '--format-only', '--', ...files]);
  if (!unknown && needsLint)
    add('lint:changed', 'Lint', ['validate:changed', '--lint-only', '--', ...files]);
  if (
    !documentationOnly &&
    !testOnly &&
    (needsTypecheck || unknown || (conservative && !toolingOnly))
  )
    add('typecheck', 'Typecheck', ['typecheck']);
  const related = relatedInputsForCi(files);
  const hasRelatedInputs =
    related.sources.some((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file)) || related.tests.length > 0;
  const changedBrowserSpecs = related.browserSpecs;
  if (!documentationOnly && !testOnly && hasRelatedInputs) {
    add(
      'unit:related',
      'Unit (related)',
      [
        'exec',
        'node',
        'scripts/validation/commands/run-related-tests.mjs',
        '--source',
        ...related.sources,
        '--test',
        ...related.tests,
      ],
      { workerSlots: validationConcurrency() },
    );
  } else if (testOnly && files.some(isTest)) {
    const tests = files.filter(
      (file) => isTest(file) && existsSync(file) && !file.startsWith('e2e/'),
    );
    if (tests.length)
      add(
        'unit:changed',
        'Unit (changed tests)',
        ['exec', 'vitest', 'run', ...tests, `--maxWorkers=${validationConcurrency()}`],
        { workerSlots: validationConcurrency() },
      );
  }
  if (
    !documentationOnly &&
    !testOnly &&
    (needsBuild || needsBrowser || needsGeometry || unknown || (conservative && !toolingOnly))
  )
    add('build', 'Build', ['build:artifact'], {
      env: E2E_BUILD_ENV,
    });
  if (changedBrowserSpecs.length > 0) {
    const workers = unitWorkerCount();
    /* Every CI plan builds once; changed specs reuse that artifact instead of racing it. */
    const options = {
      workerSlots: workers,
      env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
      dependsOn: ['build'],
    };
    add(
      'browser:changed',
      'Browser (changed specs)',
      [
        'exec',
        'playwright',
        'test',
        ...changedBrowserSpecs,
        ...CI_CHANGED_SPEC_PROJECTS.map((project) => `--project=${project}`),
        `--workers=${workers}`,
      ],
      options,
    );
    const pixelRatioSpecs = changedBrowserSpecs.filter(isPixelRatioSensitiveSpec);
    if (pixelRatioSpecs.length > 0)
      add(
        'browser:changed:2x',
        'Browser (changed 2x specs)',
        [
          'exec',
          'playwright',
          'test',
          ...pixelRatioSpecs,
          '--project=mobile-2x',
          `--workers=${workers}`,
        ],
        options,
      );
  }
  if (!documentationOnly && !testOnly && needsBrowser && !needsGeometry)
    add('browser', 'Browser smoke', ['test:e2e:smoke'], {
      workerSlots: 2,
      env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
      dependsOn: ['build'],
    });
  return appendJourneyGate(gates);
};

export const createGatePlan = (inputFiles, profile = 'push') => {
  const classification = classifyChangedFiles(inputFiles);
  const { files } = classification;
  const createFastPushPlan = () => {
    const gates = [
      {
        id: 'format',
        name: 'Format',
        required: true,
        command: 'pnpm',
        args: ['format:check'],
      },
      { id: 'lint', name: 'Lint', required: true, command: 'pnpm', args: ['lint'] },
      {
        id: 'typecheck',
        name: 'Typecheck',
        required: true,
        phase: 'TypeScript project check',
        command: 'pnpm',
        args: ['typecheck'],
      },
      unitGate('unit:fast', 'test:fast'),
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: E2E_BUILD_ENV,
      },
      {
        id: 'browser',
        name: 'Browser smoke',
        required: true,
        workerSlots: 2,
        command: 'pnpm',
        args: ['test:e2e:smoke'],
        env: {
          PLAYWRIGHT_USE_EXISTING_BUILD: 'true',
          PLAYWRIGHT_SMOKE: 'false',
          PLAYWRIGHT_DEPLOYMENT: 'false',
        },
        dependsOn: ['build'],
      },
    ];
    return gates;
  };
  if (profile === 'full') {
    return appendJourneyGate([
      { id: 'format', name: 'Format', required: true, command: 'pnpm', args: ['format:check'] },
      { id: 'lint', name: 'Lint', required: true, command: 'pnpm', args: ['lint'] },
      {
        id: 'typecheck',
        name: 'Typecheck',
        required: true,
        phase: 'TypeScript project check',
        command: 'pnpm',
        args: ['typecheck'],
      },
      unitGate('unit', 'test:full'),
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: E2E_BUILD_ENV,
      },
      {
        id: 'browser',
        name: 'Browser',
        required: true,
        workerSlots: unitWorkerCount(),
        command: 'pnpm',
        args: ['test:e2e:full'],
        env: {
          PLAYWRIGHT_WORKERS: String(unitWorkerCount()),
          PLAYWRIGHT_USE_EXISTING_BUILD:
            process.env.PLAYWRIGHT_USE_EXISTING_BUILD === 'false' ? 'false' : 'true',
          VITE_HOSTED_MODE: 'false',
          PLAYWRIGHT_SMOKE: 'false',
          PLAYWRIGHT_DEPLOYMENT: 'false',
        },
        dependsOn: ['build'],
      },
      {
        id: 'geometry',
        name: 'Geometry',
        required: true,
        workerSlots: matrixWorkerCount(),
        command: 'pnpm',
        args: ['bench:matrix'],
        env: { MATRIX_CONCURRENCY: String(matrixWorkerCount()) },
      },
    ]);
  }

  if (profile === 'ci') {
    return appendJourneyGate([
      { id: 'format', name: 'Format', required: true, command: 'pnpm', args: ['format:check'] },
      { id: 'lint', name: 'Lint', required: true, command: 'pnpm', args: ['lint'] },
      {
        id: 'typecheck',
        name: 'Typecheck',
        required: true,
        phase: 'TypeScript project check',
        command: 'pnpm',
        args: ['typecheck'],
      },
      unitGate('unit', 'test:full'),
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: E2E_BUILD_ENV,
      },
    ]);
  }

  if (profile === 'ci-browser')
    return [
      {
        id: 'browser',
        name: 'Browser',
        required: true,
        command: 'pnpm',
        args: ['test:e2e:full'],
        env: {
          PLAYWRIGHT_USE_EXISTING_BUILD: 'true',
          VITE_HOSTED_MODE: 'false',
          PLAYWRIGHT_SMOKE: 'false',
          PLAYWRIGHT_DEPLOYMENT: 'false',
        },
        workerSlots: 2,
      },
    ];
  if (profile === 'ci-geometry')
    return [
      {
        id: 'geometry',
        name: 'Geometry',
        required: true,
        command: 'pnpm',
        args: ['bench:matrix'],
        env: { MATRIX_CONCURRENCY: String(matrixWorkerCount()) },
        workerSlots: matrixWorkerCount(),
      },
    ];
  if (profile === 'bench-ui')
    return createGatePlan(
      ['src/features/customizer/components/ControlsPanel/ControlsPanel.tsx'],
      'push',
    );
  if (profile === 'bench-geometry')
    return createGatePlan(['src/domain/keychain/build/keychain-builder.ts'], 'full').filter(
      ({ id }) => id === 'geometry',
    );
  if (profile === 'bench-docs') return createGatePlan(['CONTRIBUTING.md'], 'push');

  if (profile !== 'push') throw new Error(`Unknown validation profile: ${profile}`);
  if (classification.conservative)
    return appendJourneyGate([...createFastPushPlan(), browserRegressionGate()]);
  if (classification.documentationOnly) {
    return appendJourneyGate([
      {
        id: 'format:changed',
        name: 'Format',
        required: true,
        command: 'pnpm',
        args: ['validate:changed', '--format-only', '--', ...files],
      },
    ]);
  }

  const gates = [];
  if (classification.needsFormat)
    gates.push({
      id: 'format:changed',
      name: 'Format',
      required: true,
      command: 'pnpm',
      args: ['validate:changed', '--format-only', '--', ...files],
    });
  if (classification.needsLint)
    gates.push({
      id: 'lint:changed',
      name: 'Lint',
      required: true,
      command: 'pnpm',
      args: ['validate:changed', '--lint-only', '--', ...files],
    });
  if (classification.needsTypecheck)
    gates.push({
      id: 'typecheck',
      name: 'Typecheck',
      required: true,
      phase: 'TypeScript project check',
      command: 'pnpm',
      args: ['typecheck'],
    });
  if (files.some((file) => SOURCE_ROOTS.some((root) => file.startsWith(root)))) {
    gates.push(unitGate('unit:fast', 'test:fast'));
  }
  gates.push(
    {
      id: 'build',
      name: 'Build',
      required: true,
      phase: 'Vite production artifact',
      command: 'pnpm',
      args: ['build:artifact'],
      env: E2E_BUILD_ENV,
    },
    {
      id: 'browser',
      name: 'Browser smoke',
      required: true,
      workerSlots: 2,
      command: 'pnpm',
      args: ['test:e2e:smoke'],
      env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
      dependsOn: ['build'],
    },
  );
  if (classification.needsBrowser) gates.push(browserRegressionGate());
  if (classification.needsHosting && !classification.needsBuild)
    gates.push({
      id: 'hosting',
      name: 'Hosting',
      required: true,
      command: 'pnpm',
      args: ['build:artifact'],
    });
  return appendJourneyGate(gates);
};

export const classifyRefs = (hookInput) => {
  const lines = hookInput.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    return { localRef, localSha, remoteRef, remoteSha };
  });
};

export const isZeroSha = (sha) => !sha || /^0+$/.test(sha);
