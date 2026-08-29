import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { clearInterval, setInterval } from 'node:timers';

const DEFAULT_CONCURRENCY = 2;

const gateCases = (output) => {
  const lines = output.trim().split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const summary = JSON.parse(lines[index]);
      if (Number.isFinite(summary.cases)) return summary.cases;
    } catch {
      // Most gates do not emit JSON summaries.
    }
  }
  return undefined;
};

const runCommand = (gate) =>
  new Promise((resolve) => {
    const startedAt = performance.now();
    const elapsed = () => Math.round((performance.now() - startedAt) / 1000);
    process.stdout.write(`[${gate.name}] started\n`);
    const heartbeat = setInterval(() => {
      process.stdout.write(`[${gate.name}] still running (${elapsed()}s)…\n`);
    }, 15_000);
    const child = spawn(gate.command, gate.args ?? [], {
      cwd: process.cwd(),
      env: { ...process.env, ...(gate.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearInterval(heartbeat);
      resolve({
        ...gate,
        ok: false,
        status: 1,
        durationMs: Math.round(performance.now() - startedAt),
        output: `${stderr}${error.message}\n`,
        cases: undefined,
      });
    });
    child.on('close', (status) => {
      clearInterval(heartbeat);
      resolve({
        ...gate,
        ok: status === 0,
        status: status ?? 1,
        durationMs: Math.round(performance.now() - startedAt),
        output: `${stdout}${stderr}`,
        cases: gateCases(stdout),
      });
    });
  });

const runConcurrentGates = async (
  gates,
  { concurrency = DEFAULT_CONCURRENCY, printOutput = true } = {},
) => {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = [];
  const pending = [...gates];
  const running = new Set();

  const startNext = () => {
    while (pending.length > 0 && running.size < limit) {
      const gate = pending.shift();
      const promise = runCommand(gate).then((result) => {
        results.push(result);
        running.delete(promise);
        if (printOutput && result.output) {
          process.stdout.write(`\n[${result.name}] output\n${result.output}`);
        }
        if (printOutput) {
          const count = result.cases === undefined ? '' : `, ${result.cases} cases`;
          process.stdout.write(
            `[${result.name}] ${result.ok ? 'passed' : 'failed'} (${result.durationMs}ms${count})\n`,
          );
        }
        startNext();
      });
      running.add(promise);
    }
  };

  startNext();
  while (running.size > 0) await Promise.race(running);

  if (printOutput) {
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      process.stderr.write(
        `Validation failures (${failed.length}): ${failed.map((result) => result.name).join(', ')}\n`,
      );
    }
  }
  return results;
};

/** Check prerequisites, build exactly once, then fan out independent consumers of the artifact. */
export const runValidationGates = async (
  gates,
  { concurrency = DEFAULT_CONCURRENCY, printOutput = true } = {},
) => {
  const buildGates = gates.filter((gate) => gate.name === 'build');
  const prerequisiteGates = gates.filter((gate) => gate.name === 'typecheck');
  const dependentGates = gates.filter((gate) => gate.name !== 'build' && gate.name !== 'typecheck');
  const prerequisiteResults = prerequisiteGates.length
    ? await runConcurrentGates(prerequisiteGates, { concurrency: 1, printOutput })
    : [];
  if (prerequisiteResults.some((result) => !result.ok)) return prerequisiteResults;
  const buildResults = buildGates.length
    ? await runConcurrentGates(buildGates, { concurrency: 1, printOutput })
    : [];
  if (buildResults.some((result) => !result.ok)) return [...prerequisiteResults, ...buildResults];
  const results = await runConcurrentGates(dependentGates, { concurrency, printOutput });
  return [...prerequisiteResults, ...buildResults, ...results];
};

export const defaultCiGates = [
  { name: 'format', command: 'pnpm', args: ['format:check'] },
  { name: 'lint', command: 'pnpm', args: ['lint'] },
  { name: 'typecheck', command: 'pnpm', args: ['typecheck'] },
  { name: 'unit', command: 'pnpm', args: ['test'] },
  {
    name: 'build',
    command: 'pnpm',
    args: ['build:artifact'],
    env: { VITE_GOOGLE_FONTS_API_KEY: 'playwright-google-fonts-key' },
  },
];

if (process.argv[1]?.endsWith('run-validation-gates.mjs')) {
  const results = await runValidationGates(defaultCiGates, {
    concurrency: Number.parseInt(process.env.VALIDATION_CONCURRENCY ?? '2', 10),
  });
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}
