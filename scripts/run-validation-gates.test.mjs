import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { runValidationGates } from './run-validation-gates.mjs';

const gate = (name, status = 0) => ({
  name,
  command: process.execPath,
  args: [
    '--input-type=module',
    '-e',
    `process.stdout.write(${JSON.stringify(name)}); process.exitCode = ${status};`,
  ],
});

describe('runValidationGates', () => {
  it('does not build when the typecheck prerequisite fails', async () => {
    const results = await runValidationGates([gate('typecheck', 1), gate('build'), gate('unit')], {
      printOutput: false,
    });

    expect(results.map((result) => result.name)).toEqual(['typecheck']);
    expect(results[0].ok).toBe(false);
  });

  it('runs typecheck before the artifact build and remaining gates', async () => {
    const results = await runValidationGates([gate('typecheck'), gate('build'), gate('unit')], {
      printOutput: false,
    });

    expect(results.map((result) => result.name)).toEqual(['typecheck', 'build', 'unit']);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('keeps a build-only invocation unchanged for pre-push', async () => {
    const results = await runValidationGates([gate('build'), gate('unit')], {
      printOutput: false,
    });

    expect(results.map((result) => result.name)).toEqual(['build', 'unit']);
  });
});
