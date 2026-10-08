const COMMON_INPUTS = [
  'package.json',
  'pnpm-lock.yaml',
  'scripts/validation/commands/run-validation-gates.mjs',
  'scripts/validation/core/runner.mjs',
  'scripts/validation/core/validation-plan.mjs',
  'scripts/validation/core/validation-cache.mjs',
  'scripts/validation/core/validation-git.mjs',
  'scripts/validation/core/file-types.mjs',
  'scripts/validation/core/inputs.mjs',
  'scripts/validation/core/ports.mjs',
  'scripts/build/run-tsc.mjs',
  'scripts/build/customizer-boot-plugin.ts',
  'scripts/validation/reporters/validation-vitest-reporter.mjs',
  'scripts/validation/reporters/validation-playwright-reporter.mjs',
  'scripts/validation/commands/validate-changed.mjs',
];

export const isGeometryInput = (file) =>
  file.startsWith('src/domain/keychain/') ||
  file.startsWith('src/entities/keychain/') ||
  file.startsWith('src/infrastructure/geometry/') ||
  file.startsWith('src/infrastructure/export/') ||
  file.startsWith('public/fonts/') ||
  ['public/manifold.wasm', 'public/manifold-v1.wasm'].includes(file) ||
  file.startsWith('scripts/geometry/');

export const validationInputsForGate = (gate, allInputs, changedFiles = []) => {
  const config = [...COMMON_INPUTS];
  if (gate.id.startsWith('format'))
    return [...new Set([...changedFiles, ...config, 'prettier.config.js'])];
  if (gate.id.startsWith('lint'))
    return [...new Set([...changedFiles, ...config, 'eslint.config.js'])];
  if (gate.id === 'typecheck')
    return allInputs.filter(
      (file) =>
        /\.[cm]?tsx?$/.test(file) ||
        ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', ...config].includes(file),
    );
  if (gate.id.startsWith('unit'))
    return allInputs.filter(
      (file) =>
        file.startsWith('src/') ||
        file.startsWith('scripts/') ||
        file.startsWith('public/') ||
        file.startsWith('tests/fixtures/') ||
        ['vitest.config.ts', 'tsconfig.json', ...config].includes(file),
    );
  if (gate.id === 'build')
    return allInputs.filter(
      (file) =>
        (file.startsWith('src/') && !/\.(?:test|spec)\.[^.]+$/.test(file)) ||
        file.startsWith('public/') ||
        file.startsWith('assets/') ||
        file.startsWith('.env') ||
        file === 'index.html' ||
        [
          'vite.config.ts',
          'postcss.config.js',
          'scripts/generators/generate-seo-sitemap.ts',
          ...config,
        ].includes(file),
    );
  if (gate.id === 'browser')
    return allInputs.filter(
      (file) =>
        file.startsWith('e2e/') ||
        file.startsWith('src/') ||
        file.startsWith('public/') ||
        file.startsWith('.env') ||
        [
          'index.html',
          'vite.config.ts',
          'playwright.config.ts',
          'playwright.dev-boot.config.ts',
          ...config,
        ].includes(file),
    );
  if (gate.id === 'geometry')
    return allInputs.filter(
      (file) =>
        isGeometryInput(file) || ['vitest.config.ts', 'tsconfig.json', ...config].includes(file),
    );
  return [...new Set([...changedFiles, ...config])];
};
