import path from 'node:path';

export const FORMAT_EXTENSIONS = new Set([
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

export const LINT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx']);

export const extensionOf = (file) => path.posix.extname(file).toLowerCase();
