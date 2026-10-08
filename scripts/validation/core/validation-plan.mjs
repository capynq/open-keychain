import process from 'node:process';
import os from 'node:os';
import { FORMAT_EXTENSIONS, LINT_EXTENSIONS, extensionOf } from './file-types.mjs';
import { isGeometryInput } from './inputs.mjs';
const ASSET_EXTENSIONS = /\.(?:ttf|otf|woff2?|eot|wasm|png|jpe?g|webp|svg|ico)$/i;
const SOURCE_ROOTS = ['src/', 'e2e/', 'scripts/', 'public/', 'tools/'];
const DEFAULT_VALIDATION_CONCURRENCY = Math.min(
  4,
  Math.max(1, os.availableParallelism?.() ?? os.cpus().length),
);
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
const boundedConcurrency = (name, fallback, maximum) => {
  const value = process.env[name] ?? String(fallback);
  if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum)
    throw new Error(`${name} must be an integer from 1 to ${maximum}; received ${value}`);
  return Number(value);
};
const matrixWorkerCount = () =>
  Math.min(
    boundedConcurrency('MATRIX_CONCURRENCY', DEFAULT_VALIDATION_CONCURRENCY, 5),
    boundedConcurrency('VALIDATION_CONCURRENCY', DEFAULT_VALIDATION_CONCURRENCY, 8),
  );
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
      {
        id: 'unit:fast',
        name: 'Unit',
        required: true,
        workerSlots: 2,
        command: 'pnpm',
        args: ['test:fast', '--', '--maxWorkers=2'],
      },
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
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
    return [
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
      {
        id: 'unit',
        name: 'Unit',
        required: true,
        workerSlots: 2,
        command: 'pnpm',
        args: ['test:full', '--', '--maxWorkers=2'],
      },
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
      },
      {
        id: 'browser',
        name: 'Browser',
        required: true,
        workerSlots: 2,
        command: 'pnpm',
        args: ['test:e2e:full'],
        env: {
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
    ];
  }

  if (profile === 'ci') {
    return [
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
      {
        id: 'unit',
        name: 'Unit',
        required: true,
        workerSlots: 2,
        command: 'pnpm',
        args: ['test:full', '--', '--maxWorkers=2'],
      },
      {
        id: 'build',
        name: 'Build',
        required: true,
        phase: 'Vite production artifact',
        command: 'pnpm',
        args: ['build:artifact'],
        env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
      },
    ];
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
  if (files.length === 0) return [];
  if (classification.conservative) return createFastPushPlan();
  if (classification.documentationOnly) {
    return [
      {
        id: 'format:changed',
        name: 'Format',
        required: true,
        command: 'pnpm',
        args: ['validate:changed', '--format-only', '--', ...files],
      },
    ];
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
    gates.push({
      id: 'unit:fast',
      name: 'Unit',
      required: true,
      workerSlots: 2,
      command: 'pnpm',
      args: ['test:fast', '--', '--maxWorkers=2'],
    });
  }
  gates.push(
    {
      id: 'build',
      name: 'Build',
      required: true,
      phase: 'Vite production artifact',
      command: 'pnpm',
      args: ['build:artifact'],
      env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
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
  // The complete geometry and export matrix is a CI release gate. The whole fast
  // unit suite and browser smoke remain local checks for geometry-affecting edits.
  if (classification.needsHosting && !classification.needsBuild)
    gates.push({
      id: 'hosting',
      name: 'Hosting',
      required: true,
      command: 'pnpm',
      args: ['build:artifact'],
    });
  return gates;
};

export const classifyRefs = (hookInput) => {
  const lines = hookInput.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    return { localRef, localSha, remoteRef, remoteSha };
  });
};

export const isZeroSha = (sha) => !sha || /^0+$/.test(sha);
