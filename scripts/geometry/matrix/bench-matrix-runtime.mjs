import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const readOption = (name, fallback) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
};

const fullMatrix = process.argv.includes('--full');
const runs = Number(readOption('runs', '3'));
const sampleSize = Number(readOption('sample', '100'));
const concurrency = Number(readOption('concurrency', process.env.MATRIX_CONCURRENCY ?? '2'));
if (process.env.CI === 'true') throw new Error('Runtime A/B benchmarks are local-only.');
if (!Number.isInteger(runs) || runs < 3 || runs > 10)
  throw new Error('Pass --runs=N with an integer from 3 to 10.');
if (!fullMatrix && (!Number.isInteger(sampleSize) || sampleSize < 5))
  throw new Error('Pass --sample=N with an integer of at least 5.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5)
  throw new Error('MATRIX_CONCURRENCY must be an integer from 1 to 5.');

const bunBinary = process.env.BUN_BINARY ?? 'bun';
const bunVersion = spawnSync(bunBinary, ['--version'], { encoding: 'utf8' });
if (bunVersion.error || bunVersion.status !== 0)
  throw new Error(`Bun is unavailable (${bunVersion.error?.message ?? bunVersion.stderr.trim()}).`);

const runtimes = [
  {
    id: 'node',
    version: process.version,
    executable: process.execPath,
    args: ['--import', 'tsx'],
  },
  {
    id: 'bun',
    version: bunVersion.stdout.trim(),
    executable: bunBinary,
    args: [],
  },
];
const parentScript = path.resolve('scripts/geometry/matrix/bench-matrix-parent.ts');
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'open-keychain-matrix-ab-'));
const expectedRuns = Array.from({ length: runs }, (_, index) =>
  index % 2 === 0 ? ['node', 'bun'] : ['bun', 'node'],
).flat();
const results = [];
const outcomeBaseline = new Map();

const runOne = async (runtime, runIndex) => {
  const summaryPath = path.join(temporaryDirectory, `${runtime.id}-${runIndex + 1}.json`);
  const args = [...runtime.args, parentScript];
  if (!fullMatrix) args.push(`--sample=${sampleSize}`);
  const startedAt = performance.now();
  const env = {
    ...process.env,
    VALIDATION_CACHE: '0',
    MATRIX_CONCURRENCY: String(concurrency),
    MATRIX_SUMMARY_FILE: summaryPath,
  };
  delete env.VALIDATION_GATE_ID;
  delete env.VALIDATION_EVENTS;
  const child = spawn(runtime.executable, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const wallTimeMs = Math.round(performance.now() - startedAt);
  if (status !== 0) throw new Error(`${runtime.id} matrix run ${runIndex + 1} failed (${status}).`);
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  if (summary.failed !== 0 || summary.caseOutcomes.length !== summary.cases)
    throw new Error(`${runtime.id} matrix run ${runIndex + 1} did not complete successfully.`);
  const fingerprint = JSON.stringify(summary.caseOutcomes);
  const baseline = outcomeBaseline.get(runtime.id);
  if (baseline && baseline !== fingerprint)
    throw new Error(`${runtime.id} produced inconsistent case outcomes between repetitions.`);
  outcomeBaseline.set(runtime.id, fingerprint);
  return {
    runtime: runtime.id,
    version: runtime.version,
    wallTimeMs,
    workerTimeMs: summary.durationsMs.total,
    cases: summary.cases,
    passed: summary.passed,
    expectedInvalid: summary.expectedInvalid,
    failed: summary.failed,
    workers: summary.workers,
    packageSize: summary.packageSize,
    wasmInitializationMs: summary.wasmInitializationMs,
    phaseDurationsMs: summary.phaseDurationsMs,
    cpuTimeMs: summary.cpuTimeMs,
    peakWorkerRssBytes: summary.peakWorkerRssBytes,
    peakWorkerHeapUsedBytes: summary.peakWorkerHeapUsedBytes,
    peakWorkerExternalBytes: summary.peakWorkerExternalBytes,
    slowestCases: summary.slowestCases,
    caseOutcomes: summary.caseOutcomes,
  };
};

try {
  for (const runtimeId of expectedRuns) {
    const runtime = runtimes.find((candidate) => candidate.id === runtimeId);
    const runIndex = results.filter((result) => result.runtime === runtimeId).length;
    process.stdout.write(
      `\nRuntime A/B: ${runtime.id} ${runtime.version}, run ${runIndex + 1}/${runs}\n`,
    );
    results.push(await runOne(runtime, runIndex));
  }

  const byRuntime = Object.fromEntries(
    runtimes.map((runtime) => {
      const samples = results
        .filter((result) => result.runtime === runtime.id)
        .map((result) => result.wallTimeMs)
        .sort((left, right) => left - right);
      return [runtime.id, { medianMs: samples[Math.floor(samples.length / 2)], runsMs: samples }];
    }),
  );
  const nodeRows = results.filter((result) => result.runtime === 'node');
  const bunRows = results.filter((result) => result.runtime === 'bun');
  const parity = nodeRows[0].caseOutcomes.every(
    (outcome, index) => JSON.stringify(outcome) === JSON.stringify(bunRows[0].caseOutcomes[index]),
  );
  const wallTimeGain = 1 - byRuntime.bun.medianMs / byRuntime.node.medianMs;
  const nodeRss = Math.max(...nodeRows.map((result) => result.peakWorkerRssBytes));
  const bunRss = Math.max(...bunRows.map((result) => result.peakWorkerRssBytes));
  const report = {
    schema: 'geometry-runtime-ab.v1',
    generatedAt: new Date().toISOString(),
    platform: `${process.platform}/${process.arch}`,
    nodeVersion: process.version,
    bunVersion: bunVersion.stdout.trim(),
    matrix: fullMatrix ? 'full' : 'stratified-sample',
    sampleSize: fullMatrix ? undefined : sampleSize,
    concurrency,
    runs,
    parity,
    byRuntime,
    wallTimeGain,
    rssRatio: nodeRss > 0 ? bunRss / nodeRss : undefined,
    eligibleForAdoption: parity && wallTimeGain >= 0.2 && nodeRss > 0 && bunRss <= nodeRss * 1.1,
    results: results.map((result) => {
      const sanitized = { ...result };
      delete sanitized.caseOutcomes;
      return sanitized;
    }),
  };
  const outputDirectory = path.resolve('node_modules/.cache/open-keychain-validation/benchmarks');
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `runtime-ab-${new Date().toISOString().replaceAll(':', '-')}.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `\nRuntime A/B report: ${outputPath}\n${JSON.stringify(
      {
        parity: report.parity,
        byRuntime: report.byRuntime,
        wallTimeGain: `${(report.wallTimeGain * 100).toFixed(1)}%`,
        rssRatio: report.rssRatio?.toFixed(2),
        eligibleForAdoption: report.eligibleForAdoption,
      },
      null,
      2,
    )}\n`,
  );
  if (!parity) process.exitCode = 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
