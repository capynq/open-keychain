import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { runValidationGates, validationInputsForGate } from './run-validation-gates.mjs';

const gate = (name, status = 0, extra = {}) => ({
  id: name,
  name,
  command: process.execPath,
  args: [
    '--input-type=module',
    '-e',
    `process.stdout.write(${JSON.stringify(name)}); process.exitCode=${status};`,
  ],
  ...extra,
});

describe('validation scheduler', () => {
  it('keeps gate cache inputs specific while retaining geometry assets and export code', () => {
    const allInputs = [
      'README.md',
      'public/fonts/body.woff2',
      'public/manifold.wasm',
      'src/domain/keychain/build/keychain-builder.ts',
      'src/infrastructure/export/stl-serializer.ts',
      'src/features/customizer/components/Editor.tsx',
      'scripts/bench-matrix.ts',
      'scripts/validation-cache.mjs',
      'package.json',
      'pnpm-lock.yaml',
    ];
    const geometry = validationInputsForGate({ id: 'geometry' }, allInputs);
    expect(geometry).toContain('public/fonts/body.woff2');
    expect(geometry).toContain('public/manifold.wasm');
    expect(geometry).toContain('src/infrastructure/export/stl-serializer.ts');
    expect(geometry).toContain('scripts/validation-cache.mjs');
    expect(geometry).not.toContain('README.md');
    expect(geometry).not.toContain('src/features/customizer/components/Editor.tsx');
  });

  it('runs independent gates without imposing a build prerequisite', async () => {
    const results = await runValidationGates([gate('typecheck'), gate('build'), gate('unit')], {
      printOutput: false,
      mode: 'plain',
      cache: false,
      concurrency: 3,
      profile: 'ci',
      failFast: false,
    });
    expect(results.map((result) => result.id).sort()).toEqual(['build', 'typecheck', 'unit']);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('blocks only a gate whose required dependency failed', async () => {
    const results = await runValidationGates(
      [gate('build', 1), gate('browser', 0, { dependsOn: ['build'] }), gate('unit')],
      { mode: 'plain', cache: false, concurrency: 3, profile: 'ci', failFast: false },
    );
    expect(results.find((result) => result.id === 'build').status).toBe('failed');
    expect(results.find((result) => result.id === 'browser').status).toBe('blocked');
    expect(results.find((result) => result.id === 'unit').status).toBe('passed');
  });

  it('stops a failed run and force-kills a child process tree that ignores SIGTERM', async () => {
    const slow = gate('slow', 0, {
      args: [
        '--input-type=module',
        '-e',
        `import { spawn } from 'node:child_process'; const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' }); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`,
      ],
    });
    const startedAt = Date.now();
    const results = await runValidationGates([gate('failure', 1), slow], {
      mode: 'plain',
      cache: false,
      concurrency: 2,
      profile: 'quick',
      failFast: true,
    });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4500);
    expect(results.find((result) => result.id === 'failure').status).toBe('failed');
    expect(results.find((result) => result.id === 'slow').status).toBe('cancelled');
  }, 10000);

  it('rejects non-positive, fractional and unreasonable concurrency', async () => {
    for (const concurrency of [0, -1, 1.5, 9, Number.NaN]) {
      await expect(
        runValidationGates([], { concurrency, mode: 'plain', cache: false }),
      ).rejects.toThrow(/concurrency/i);
    }
  });
});
