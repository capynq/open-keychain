import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const files = args.filter((file) => file !== '--fix' && file !== '--');

const FORMAT_EXTENSIONS = new Set([
  '.css',
  '.cjs',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const LINT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx']);
const extensionOf = (file) => {
  const match = /\.[^.]+$/.exec(file);
  return match?.[0].toLowerCase() ?? '';
};
const existingFiles = files.filter((file) => existsSync(file));
const formatFiles = existingFiles.filter((file) => FORMAT_EXTENSIONS.has(extensionOf(file)));
const lintFiles = existingFiles.filter((file) => LINT_EXTENSIONS.has(extensionOf(file)));

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (formatFiles.length > 0) {
  run('pnpm', ['exec', 'prettier', fix ? '--write' : '--check', '--', ...formatFiles]);
}
if (lintFiles.length > 0) {
  run('pnpm', ['exec', 'eslint', ...(fix ? ['--fix'] : []), '--', ...lintFiles]);
}
