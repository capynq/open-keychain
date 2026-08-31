import { readFileSync } from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { runValidationGates } from './run-validation-gates.mjs';

const runResult = (command, args, options = {}) =>
  spawnSync(command, args, { stdio: 'inherit', ...options });

const run = (command, args, options = {}) => {
  const result = runResult(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
};

const capture = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
};

const hasChanges = (args) => spawnSync('git', args).status !== 0;
const isZeroSha = (sha) => !sha || /^0+$/.test(sha);

const DOCUMENTATION_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

const extensionOf = (file) => {
  const match = /\.[^.]+$/.exec(file);
  return match?.[0].toLowerCase() ?? '';
};

const isSourceTestFile = (file) => {
  const normalized = file.replaceAll('\\', '/');
  return normalized.startsWith('src/') && /\.test\.[^.]+$/.test(normalized);
};

const isDocumentationFile = (file) => {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.startsWith('public/') || normalized.startsWith('src/')) return false;
  return (
    normalized === 'README' ||
    normalized.startsWith('README.') ||
    normalized === 'CONTRIBUTING.md' ||
    normalized === 'LICENSE' ||
    normalized.startsWith('docs/') ||
    DOCUMENTATION_EXTENSIONS.has(extensionOf(normalized))
  );
};

const isBrowserRelevantFile = (file) => {
  const normalized = file.replaceAll('\\', '/');
  if (isSourceTestFile(normalized)) return false;
  return (
    normalized.startsWith('e2e/') ||
    normalized.startsWith('public/') ||
    normalized.startsWith('src/app/') ||
    normalized.startsWith('src/components/') ||
    normalized.startsWith('src/features/') ||
    normalized.startsWith('src/pages/') ||
    normalized.startsWith('src/widgets/') ||
    normalized.startsWith('src/shared/ui/') ||
    normalized.startsWith('src/shared/lib/') ||
    normalized.startsWith('src/shared/styles/') ||
    normalized.startsWith('src/infrastructure/export/') ||
    normalized.startsWith('src/infrastructure/i18n/') ||
    normalized.startsWith('src/infrastructure/seo/') ||
    normalized.startsWith('src/main') ||
    normalized === 'index.html' ||
    normalized.startsWith('playwright.') ||
    normalized.startsWith('playwright-')
  );
};

const isGeometryOrFontFile = (file) => {
  const normalized = file.replaceAll('\\', '/');
  return (
    normalized.startsWith('src/domain/keychain/') ||
    normalized.startsWith('src/entities/keychain/') ||
    normalized.startsWith('src/infrastructure/geometry/') ||
    normalized.startsWith('public/fonts/') ||
    normalized === 'public/manifold.wasm' ||
    normalized.startsWith('scripts/bench-') ||
    normalized.startsWith('scripts/generate-validation-fixtures') ||
    /\.(ttf|otf|woff2?|eot)$/i.test(normalized)
  );
};

const isDockerOrHostingFile = (file) => {
  const normalized = file.replaceAll('\\', '/');
  return (
    /(^|\/)Dockerfile(?:\.|$)/i.test(normalized) ||
    normalized === '.dockerignore' ||
    normalized.startsWith('docker-compose') ||
    normalized.startsWith('nginx') ||
    normalized === '.env.hosted.example' ||
    normalized === 'netlify.toml' ||
    normalized === 'playwright.deployment.config.ts' ||
    normalized.startsWith('scripts/validate-static-deployment') ||
    normalized.startsWith('scripts/package-self-hosted-evidence') ||
    normalized.startsWith('server/')
  );
};

export const classifyChangedFiles = (files) => {
  const documentationOnly = files.length > 0 && files.every(isDocumentationFile);
  return {
    documentationOnly,
    needsCoreValidation: !documentationOnly,
    needsBrowserValidation: files.some(isBrowserRelevantFile),
    needsGeometryBenchmark: files.some(isGeometryOrFontFile),
    needsDockerValidation: files.some(isDockerOrHostingFile),
  };
};

export const collectChangedFiles = (hookInput, captureDiff = capture) => {
  const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const records = hookInput.length > 0 ? hookInput : [''];
  return [
    ...new Set(
      records.flatMap((record) => {
        const [, localSha, , remoteSha] = record.split(/\s+/);
        if (localSha && isZeroSha(localSha)) return [];
        const localCommit = localSha || capture(['rev-parse', 'HEAD']).trim();
        const changedArgs = isZeroSha(remoteSha)
          ? ['diff', '--name-only', '-z', '--diff-filter=ACMRD', emptyTree, localCommit]
          : ['diff', '--name-only', '-z', '--diff-filter=ACMRD', remoteSha, localCommit];
        return captureDiff(changedArgs).split('\0').filter(Boolean);
      }),
    ),
  ];
};

const runDockerValidation = () => {
  run('docker', ['compose', '-f', 'docker-compose.yml', 'config']);
  run('docker', [
    'compose',
    '--env-file',
    '.env.hosted.example',
    '-f',
    'docker-compose.hosted.yml',
    'config',
  ]);

  let validationStatus = 1;
  try {
    const up = runResult('docker', [
      'compose',
      'up',
      '-d',
      '--build',
      '--wait',
      '--wait-timeout',
      '120',
    ]);
    validationStatus = up.error ? 1 : (up.status ?? 1);
    if (validationStatus === 0) {
      const validation = runResult('pnpm', ['validate:self-hosted'], {
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:8080',
          SELF_HOSTED_BASE_URL: 'http://127.0.0.1:8080',
        },
      });
      validationStatus = validation.error ? 1 : (validation.status ?? 1);
    }

    if (validationStatus !== 0) {
      runResult('docker', ['compose', 'logs', '--no-color']);
    }
  } finally {
    const cleanup = runResult('docker', ['compose', 'down', '--volumes', '--remove-orphans']);
    if (validationStatus === 0 && (cleanup.error || cleanup.status !== 0)) {
      validationStatus = cleanup.status ?? 1;
    }
  }
  if (validationStatus !== 0) process.exit(validationStatus);
};

export const runPrePush = async () => {
  if (hasChanges(['diff', '--quiet']) || hasChanges(['diff', '--cached', '--quiet'])) {
    process.stderr.write('pre-push: commit or stash tracked changes before validation.\n');
    process.exit(1);
  }

  const hookInput = readFileSync(0, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const files = collectChangedFiles(hookInput);

  if (files.length === 0) process.exit(0);

  const script = fileURLToPath(new URL('./validate-changed.mjs', import.meta.url));
  run(process.execPath, [script, '--', ...files]);

  const classification = classifyChangedFiles(files);
  process.stdout.write(
    `pre-push: ${files.length} changed file${files.length === 1 ? '' : 's'}; ` +
      `core=${classification.needsCoreValidation ? 'yes' : 'no'}, ` +
      `browser=${classification.needsBrowserValidation ? 'yes' : 'no'}, ` +
      `geometry=${classification.needsGeometryBenchmark ? 'yes' : 'no'}, ` +
      `docker=${classification.needsDockerValidation ? 'yes' : 'no'}\n`,
  );
  if (classification.needsCoreValidation) {
    const buildResults = await runValidationGates(
      [
        {
          name: 'build',
          command: 'pnpm',
          args: ['build'],
          env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
        },
      ],
      { concurrency: 1 },
    );
    if (buildResults.some((result) => !result.ok)) process.exit(1);

    // `pnpm build` already runs `tsc -b`; avoid running the same typecheck twice.
    const gates = [{ name: 'unit', command: 'pnpm', args: ['test'] }];
    if (classification.needsBrowserValidation) {
      const browserCommand = process.env.PUSH_E2E_MODE === 'full' ? 'test:e2e' : 'test:e2e:smoke';
      gates.push({
        name: 'browser',
        command: 'pnpm',
        args:
          browserCommand === 'test:e2e'
            ? [browserCommand, `--workers=${process.env.PUSH_E2E_WORKERS ?? '2'}`]
            : [browserCommand],
        env: { PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
      });
    }
    if (classification.needsGeometryBenchmark)
      gates.push({ name: 'geometry', command: 'pnpm', args: ['bench:matrix'] });
    process.stdout.write(
      `pre-push: running ${gates.map((gate) => gate.name).join(', ')} after build ` +
        `(parallel limit ${process.env.VALIDATION_CONCURRENCY ?? '2'})\n`,
    );
    const results = await runValidationGates(gates, {
      concurrency: Number.parseInt(process.env.VALIDATION_CONCURRENCY ?? '2', 10),
    });
    if (results.some((result) => !result.ok)) process.exit(1);
  }
  if (classification.needsDockerValidation) runDockerValidation();
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runPrePush();
}
