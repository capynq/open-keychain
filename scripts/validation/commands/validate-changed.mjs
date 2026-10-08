import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { FORMAT_EXTENSIONS, LINT_EXTENSIONS, extensionOf } from '../core/file-types.mjs';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const formatOnly = args.includes('--format-only');
const lintOnly = args.includes('--lint-only');
const files = args.filter(
  (file) => !['--fix', '--format-only', '--lint-only', '--'].includes(file),
);

const existingFiles = files.filter((file) => existsSync(file));
const formatFiles = existingFiles.filter((file) => FORMAT_EXTENSIONS.has(extensionOf(file)));
const lintFiles = existingFiles.filter((file) => LINT_EXTENSIONS.has(extensionOf(file)));

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!lintOnly && formatFiles.length > 0) {
  run('pnpm', ['exec', 'prettier', fix ? '--write' : '--check', '--', ...formatFiles]);
}
if (!formatOnly && lintFiles.length > 0) {
  run('pnpm', [
    'exec',
    'eslint',
    ...(fix ? ['--fix'] : []),
    '--cache',
    '--cache-location',
    'node_modules/.cache/eslint',
    '--cache-strategy',
    'content',
    '--max-warnings=0',
    '--',
    ...lintFiles,
  ]);
}
