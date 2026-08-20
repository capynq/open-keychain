import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

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
  return (
    normalized.startsWith('e2e/') ||
    normalized.startsWith('public/') ||
    normalized.startsWith('src/app/') ||
    normalized.startsWith('src/components/') ||
    normalized.startsWith('src/features/') ||
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

export const runPrePush = () => {
  if (hasChanges(['diff', '--quiet']) || hasChanges(['diff', '--cached', '--quiet'])) {
    process.stderr.write('pre-push: commit or stash tracked changes before automatic repair.\n');
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
  run(process.execPath, [script, '--fix', '--', ...files]);
  const existingFiles = files.filter((file) => existsSync(file));
  if (existingFiles.length > 0) run('git', ['add', '--update', '--', ...existingFiles]);
  run(process.execPath, [script, '--', ...files]);

  const stagedChanges = spawnSync('git', ['diff', '--cached', '--quiet']);
  if (stagedChanges.status !== 0) {
    run('git', ['commit', '--amend', '--no-edit', '--no-verify']);
    process.stderr.write('pre-push: automatic fixes were committed; run git push again.\n');
    process.exit(1);
  }

  const classification = classifyChangedFiles(files);
  if (classification.needsCoreValidation) {
    run('pnpm', ['typecheck']);
    run('pnpm', ['test']);
    run('pnpm', ['build'], {
      env: { ...process.env, VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
    });
  }
  if (classification.needsBrowserValidation) {
    run('pnpm', ['test:e2e', '--workers=1'], {
      env: { ...process.env, PLAYWRIGHT_USE_EXISTING_BUILD: 'true' },
    });
  }
  if (classification.needsGeometryBenchmark) run('pnpm', ['bench:matrix']);
  if (classification.needsDockerValidation) runDockerValidation();
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runPrePush();
}
