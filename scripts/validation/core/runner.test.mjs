import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { runValidationGates } from './runner.mjs';
import { validationInputsForGate } from './inputs.mjs';

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
      'scripts/geometry/matrix/bench-matrix.ts',
      'scripts/validation/core/validation-cache.mjs',
      'package.json',
      'pnpm-lock.yaml',
    ];
    const geometry = validationInputsForGate({ id: 'geometry' }, allInputs);
    expect(geometry).toContain('public/fonts/body.woff2');
    expect(geometry).toContain('public/manifold.wasm');
    expect(geometry).toContain('src/infrastructure/export/stl-serializer.ts');
    expect(geometry).toContain('scripts/validation/core/validation-cache.mjs');
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

  it('passes an available local port to the Browser gate and respects an explicit port', async () => {
    const browserGate = (id, extra = {}) =>
      gate(id, 0, {
        args: [
          '--input-type=module',
          '-e',
          'process.stdout.write(process.env.PLAYWRIGHT_PREVIEW_PORT)',
        ],
        ...extra,
      });
    let selections = 0;
    const automatic = await runValidationGates([browserGate('browser')], {
      mode: 'plain',
      cache: false,
      concurrency: 1,
      profile: 'ci',
      selectBrowserPort: async () => {
        selections += 1;
        return 48_321;
      },
    });
    expect(automatic[0].tail).toContain('48321');
    expect(selections).toBe(1);

    const explicit = await runValidationGates(
      [browserGate('browser', { env: { PLAYWRIGHT_PREVIEW_PORT: '4173' } })],
      {
        mode: 'plain',
        cache: false,
        concurrency: 1,
        profile: 'ci',
        selectBrowserPort: async () => {
          selections += 1;
          return 49_001;
        },
      },
    );
    expect(explicit[0].tail).toContain('4173');
    expect(selections).toBe(1);
  });

  it('reports a preview-port allocation failure as a failed Browser gate', async () => {
    const results = await runValidationGates([gate('browser')], {
      mode: 'plain',
      cache: false,
      concurrency: 1,
      profile: 'ci',
      selectBrowserPort: async () => {
        throw new Error('listen EPERM');
      },
    });

    expect(results[0]).toMatchObject({ id: 'browser', ok: false, status: 'failed' });
    expect(results[0].tail).toContain('listen EPERM');
  });

  it('stops a failed run and force-kills a child process tree that ignores SIGTERM', async () => {
    const failure = gate('failure', 1, {
      args: [
        '--input-type=module',
        '-e',
        'await new Promise((resolve) => setTimeout(resolve, 500)); process.exitCode = 1;',
      ],
    });
    const slow = gate('slow', 0, {
      args: [
        '--input-type=module',
        '-e',
        `import { spawn } from 'node:child_process'; process.on('SIGTERM', () => {}); const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' }); child.once('spawn', () => process.stdout.write('slow-ready\\n')); setInterval(() => {}, 1000);`,
      ],
    });
    const startedAt = Date.now();
    const results = await runValidationGates([failure, slow], {
      mode: 'plain',
      cache: false,
      concurrency: 2,
      profile: 'quick',
      failFast: true,
    });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4500);
    expect(results.find((result) => result.id === 'failure').status).toBe('failed');
    expect(results.find((result) => result.id === 'slow').status).toBe('cancelled');
    expect(results.find((result) => result.id === 'slow').tail).toContain('slow-ready');
  }, 10000);

  it('rejects non-positive, fractional and unreasonable concurrency', async () => {
    for (const concurrency of [0, -1, 1.5, 9, Number.NaN]) {
      await expect(
        runValidationGates([], { concurrency, mode: 'plain', cache: false }),
      ).rejects.toThrow(/concurrency/i);
    }
  });
});
