import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const main = async () => {
  const requested = process.argv[2] ?? 'push';
  if (requested === 'runtime') {
    const child = spawn(
      process.execPath,
      ['scripts/geometry/matrix/bench-matrix-runtime.mjs', ...process.argv.slice(3)],
      { stdio: 'inherit', env: process.env },
    );
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    process.exitCode = status === 0 ? 0 : (status ?? 1);
    return;
  }
  const runs = Number(process.argv[3] ?? 2);
  const profile =
    requested === 'push'
      ? 'bench-push'
      : requested === 'ui'
        ? 'bench-ui'
        : requested === 'geometry'
          ? 'bench-geometry'
          : requested === 'docs'
            ? 'bench-docs'
            : requested;
  const allowed = [
    'bench-push',
    'bench-ui',
    'bench-geometry',
    'bench-docs',
    'full',
    'ci',
    'ci-browser',
    'ci-geometry',
  ];
  if (!allowed.includes(profile) || !Number.isInteger(runs) || runs < 1 || runs > 10) {
    process.stderr.write(
      'Usage: pnpm validate:bench [push|ui|geometry|docs|runtime|full|ci] [runs: 1-10]\n',
    );
    process.exitCode = 2;
    return;
  }
  const timings = [];
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    const child = spawn(
      process.execPath,
      ['scripts/validation/commands/run-validation-gates.mjs', profile],
      {
        stdio: 'inherit',
        env: { ...process.env, VALIDATION_UI: 'plain', VALIDATION_BENCH_RUN: String(index + 1) },
      },
    );
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    const durationMs = Math.round(performance.now() - started);
    timings.push(durationMs);
    process.stdout.write(`benchmark ${index + 1}/${runs}: ${durationMs}ms; exit=${status}\n`);
    if (status !== 0) process.exitCode = status ?? 1;
  }
  process.stdout.write(
    `${JSON.stringify({ profile, runs, timingsMs: timings, minMs: Math.min(...timings), maxMs: Math.max(...timings) })}\n`,
  );
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
