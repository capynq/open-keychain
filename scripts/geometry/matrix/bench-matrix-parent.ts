import type { Readable, Writable } from 'node:stream';

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  listMatrixCases,
  partitionMatrixCases,
  partitionMatrixCasesByShard,
  selectMatrixBenchmarkSample,
} from './bench-matrix-cases';
import { EXPECTED_MATRIX_CASE_COUNT } from './matrix-contract';

const boundedInteger = (name: string, fallback: number, maximum: number): number => {
  const raw = process.env[name] ?? String(fallback);
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > maximum)
    throw new Error(`${name} must be an integer from 1 to ${maximum}; received ${raw}`);
  return Number(raw);
};
const cpuLimit = Math.max(1, Math.min(5, os.availableParallelism?.() ?? os.cpus().length));
const concurrency = boundedInteger('MATRIX_CONCURRENCY', Math.min(2, cpuLimit), cpuLimit);
const packageSize = boundedInteger('MATRIX_PACKAGE_SIZE', 4, 16);
const allCases = listMatrixCases();
if (allCases.length !== EXPECTED_MATRIX_CASE_COUNT)
  throw new Error(
    `Geometry case count changed: expected ${EXPECTED_MATRIX_CASE_COUNT}, got ${allCases.length}. Review full matrix coverage before updating the contract.`,
  );
const uniqueIds = new Set(allCases.map((item) => item.id));
if (uniqueIds.size !== allCases.length)
  throw new Error(
    `Matrix contains duplicate IDs (${allCases.length} cases, ${uniqueIds.size} unique).`,
  );
const sampleArgument = process.argv.find((argument) => argument.startsWith('--sample='));
const sampleSize = sampleArgument ? Number(sampleArgument.slice('--sample='.length)) : undefined;
if (sampleArgument && (!Number.isInteger(sampleSize) || sampleSize! < 1))
  throw new Error(`Invalid matrix profile sample size: ${sampleArgument}`);
if (sampleArgument && (process.env.CI === 'true' || process.env.VALIDATION_GATE_ID))
  throw new Error('Matrix profile samples cannot run in CI or inside a validation gate.');
const shardIndexRaw = process.env.MATRIX_SHARD_INDEX;
const shardCountRaw = process.env.MATRIX_SHARD_COUNT;
if (Boolean(shardIndexRaw) !== Boolean(shardCountRaw))
  throw new Error('MATRIX_SHARD_INDEX and MATRIX_SHARD_COUNT must be set together.');
if (sampleArgument && shardCountRaw)
  throw new Error('Matrix profile samples cannot be combined with CI shard selection.');
const shardIndex = shardIndexRaw ? Number(shardIndexRaw) : undefined;
const shardCount = shardCountRaw ? Number(shardCountRaw) : undefined;
if (shardCountRaw && (!Number.isInteger(shardCount) || !Number.isInteger(shardIndex)))
  throw new Error('MATRIX_SHARD_INDEX and MATRIX_SHARD_COUNT must be integers.');
const selectedCases = sampleSize
  ? selectMatrixBenchmarkSample(allCases, sampleSize)
  : shardCount !== undefined
    ? partitionMatrixCasesByShard(allCases, shardIndex!, shardCount)
    : allCases;
const cases = selectedCases;
if (
  shardCount !== undefined &&
  process.env.VALIDATION_GATE_ID &&
  process.env.VALIDATION_CACHE !== '0'
)
  throw new Error(
    'Sharded geometry validation requires VALIDATION_CACHE=0; shard results are partial.',
  );

type CaseResult = {
  id: string;
  templateId: string;
  category: 'passed' | 'expectedInvalid' | 'failed';
  warnings: string[];
  durationMs?: number;
  failure?: { reason: string; issues: string[] };
};
type Worker = {
  id: number;
  child: ChildProcessByStdio<Writable, Readable, null>;
  closed: Promise<void>;
  active?: { name: string; startedAt: number };
  busy: boolean;
  input: readline.Interface;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  rssBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
};
const packages = partitionMatrixCases(cases, packageSize);
const workerPath = fileURLToPath(new URL('./bench-matrix.ts', import.meta.url));
const startedAt = performance.now();
const records = new Map<string, CaseResult>();
const workers: Worker[] = [];
let nextPackage = 0;
let completed = 0;
let failedWorkers = false;
let peakWorkerRssBytes = 0;
let peakWorkerHeapUsedBytes = 0;
let peakWorkerExternalBytes = 0;
let wasmInitializationMs = 0;
const phaseDurationTotals = {
  buildKeychainMs: 0,
  meshValidationMs: 0,
  stlMs: 0,
  threeMfMs: 0,
};
const slowestCases: Array<{ case: string; durationMs: number }> = [];
const emit = (status: string, values: Record<string, unknown> = {}) => {
  if (process.env.VALIDATION_EVENTS === '1')
    process.stdout.write(`\u001e${JSON.stringify({ gateId: 'geometry', status, ...values })}\n`);
};
const sendPackage = (worker: Worker) => {
  const packageData = packages[nextPackage++];
  if (!packageData) {
    worker.busy = false;
    worker.child.stdin.end();
    return;
  }
  worker.busy = true;
  worker.child.stdin.write(`${JSON.stringify(packageData)}\n`);
};
const consume = (worker: Worker, line: string) => {
  if (!line) return;
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    process.stderr.write(`[geometry worker ${worker.id}] invalid event: ${line.slice(0, 300)}\n`);
    failedWorkers = true;
    return;
  }
  if (event.type === 'worker-ready') {
    wasmInitializationMs += Number(event.wasmInitializationMs) || 0;
    return;
  }
  if (event.type === 'case-started') {
    worker.active = { name: String(event.name), startedAt: Date.now() };
    emit('case-started', { name: event.name, workerId: worker.id });
    return;
  }
  if (event.type === 'case-completed') {
    const result = event as unknown as CaseResult;
    if (records.has(result.id)) {
      failedWorkers = true;
      process.stderr.write(`Duplicate matrix result: ${result.id}\n`);
    } else records.set(result.id, result);
    const phases = event.phaseDurationsMs as Partial<typeof phaseDurationTotals> | undefined;
    for (const name of Object.keys(phaseDurationTotals) as Array<keyof typeof phaseDurationTotals>)
      phaseDurationTotals[name] += Number(phases?.[name]) || 0;
    worker.rssBytes = Number(event.rssBytes) || worker.rssBytes;
    worker.heapUsedBytes = Number(event.heapUsedBytes) || worker.heapUsedBytes;
    worker.externalBytes = Number(event.externalBytes) || worker.externalBytes;
    peakWorkerRssBytes = Math.max(peakWorkerRssBytes, worker.rssBytes);
    peakWorkerHeapUsedBytes = Math.max(peakWorkerHeapUsedBytes, worker.heapUsedBytes);
    peakWorkerExternalBytes = Math.max(peakWorkerExternalBytes, worker.externalBytes);
    if (Number.isFinite(result.durationMs)) {
      slowestCases.push({ case: result.id, durationMs: result.durationMs ?? 0 });
      slowestCases.sort((left, right) => right.durationMs - left.durationMs);
      slowestCases.length = Math.min(10, slowestCases.length);
    }
    worker.active = undefined;
    completed += 1;
    emit('case-completed', {
      name: event.name,
      workerId: worker.id,
      outcome: event.category,
      durationMs: result.durationMs,
      phaseDurationsMs: event.phaseDurationsMs,
      cpuUserMicros: event.cpuUserMicros,
      cpuSystemMicros: event.cpuSystemMicros,
    });
    if (completed === cases.length || completed % 10 === 0 || Date.now() - lastProgressAt >= 200) {
      lastProgressAt = Date.now();
      emit('gate-progress', {
        completed,
        total: cases.length,
        detail: `last: ${String(event.name)}`,
      });
    }
    return;
  }
  if (event.type === 'package-completed') {
    worker.rssBytes = Number(event.rssBytes) || worker.rssBytes;
    worker.heapUsedBytes = Number(event.heapUsedBytes) || worker.heapUsedBytes;
    worker.externalBytes = Number(event.externalBytes) || worker.externalBytes;
    worker.cpuUserMicros = Number(event.cpuUserMicros) || worker.cpuUserMicros;
    worker.cpuSystemMicros = Number(event.cpuSystemMicros) || worker.cpuSystemMicros;
    peakWorkerRssBytes = Math.max(peakWorkerRssBytes, worker.rssBytes);
    peakWorkerHeapUsedBytes = Math.max(peakWorkerHeapUsedBytes, worker.heapUsedBytes);
    peakWorkerExternalBytes = Math.max(peakWorkerExternalBytes, worker.externalBytes);
    worker.busy = false;
    sendPackage(worker);
  }
};
let lastProgressAt = Date.now();

const spawnWorker = (id: number): Worker => {
  const workerArgs = process.versions.bun ? [workerPath] : ['--import', 'tsx', workerPath];
  const child = spawn(process.execPath, workerArgs, {
    cwd: process.cwd(),
    env: { ...process.env, MATRIX_WORKER: '1', MATRIX_WORKER_ID: String(id) },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  const input = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const worker: Worker = {
    id,
    child,
    closed,
    busy: false,
    input,
    cpuUserMicros: 0,
    cpuSystemMicros: 0,
    rssBytes: 0,
    heapUsedBytes: 0,
    externalBytes: 0,
  };
  input.on('line', (line) => consume(worker, line));
  child.on('error', (error) => {
    failedWorkers = true;
    process.stderr.write(`[geometry worker ${id}] ${error.message}\n`);
  });
  child.on('close', (status, signal) => {
    if (status !== 0 && (worker.busy || nextPackage < packages.length)) {
      failedWorkers = true;
      process.stderr.write(`[geometry worker ${id}] exited (${signal ?? status})\n`);
    }
  });
  return worker;
};

const progressTimer = setInterval(
  () => {
    const active =
      workers
        .filter((worker) => worker.active)
        .map(
          (worker) =>
            `${worker.id}:${worker.active?.name} (${Math.floor((Date.now() - (worker.active?.startedAt ?? Date.now())) / 1000)}s)`,
        )
        .join(' · ') || 'waiting for workers';
    const elapsed = Math.floor((performance.now() - startedAt) / 1000);
    if (process.env.VALIDATION_EVENTS === '1')
      emit('gate-progress', { completed, total: cases.length, detail: active });
    else
      process.stdout.write(
        `Geometry ${completed}/${cases.length} cases · ${workers.length} workers · ${elapsed}s · ${active}\n`,
      );
  },
  process.env.VALIDATION_EVENTS === '1' ? 250 : 5000,
);

try {
  workers.push(
    ...Array.from({ length: Math.min(concurrency, packages.length) }, (_, index) =>
      spawnWorker(index + 1),
    ),
  );
  for (const worker of workers) sendPackage(worker);
  await Promise.all(workers.map((worker) => worker.closed));
} finally {
  clearInterval(progressTimer);
}

const summary = {
  schema: 'geometry-matrix-summary.v1',
  mode: sampleSize ? 'profile-sample' : shardCount !== undefined ? 'shard' : 'full',
  cases: cases.length,
  fullCaseCount: allCases.length,
  passed: 0,
  expectedInvalid: 0,
  failed: 0,
  warnings: {} as Record<string, number>,
  byTemplate: {} as Record<
    string,
    { cases: number; passed: number; expectedInvalid: number; failed: number }
  >,
  failures: [] as Array<{ case: string; reason: string; issues: string[] }>,
  truncatedFailures: 0,
  durationsMs: { total: Math.round(performance.now() - startedAt) },
  workers: concurrency,
  packageSize,
  packages: packages.length,
  slowestCases,
  wasmInitializationMs: Math.round(wasmInitializationMs),
  phaseDurationsMs: Object.fromEntries(
    Object.entries(phaseDurationTotals).map(([name, duration]) => [name, Math.round(duration)]),
  ),
  peakWorkerRssBytes,
  peakWorkerHeapUsedBytes,
  peakWorkerExternalBytes,
  cpuTimeMs: {
    user: Math.round(workers.reduce((total, worker) => total + worker.cpuUserMicros, 0) / 1000),
    system: Math.round(workers.reduce((total, worker) => total + worker.cpuSystemMicros, 0) / 1000),
  },
  ...(shardCount !== undefined ? { shardIndex, shardCount } : {}),
  ...(sampleSize ? { sampleSize } : {}),
  caseIds: cases.map((item) => item.id),
  caseOutcomes: cases.map((item) => {
    const result = records.get(item.id);
    return result
      ? {
          id: item.id,
          category: result.category,
          warnings: result.warnings,
          failure: result.failure?.reason,
        }
      : { id: item.id, category: 'missing' };
  }),
};
for (const item of cases) {
  const result = records.get(item.id);
  if (!result) {
    summary.failed += 1;
    summary.failures.push({ case: item.id, reason: 'missing-result', issues: [] });
    continue;
  }
  const template = (summary.byTemplate[result.templateId] ??= {
    cases: 0,
    passed: 0,
    expectedInvalid: 0,
    failed: 0,
  });
  template.cases += 1;
  template[result.category] += 1;
  summary[result.category] += 1;
  for (const warning of result.warnings)
    summary.warnings[warning] = (summary.warnings[warning] ?? 0) + 1;
  if (result.failure) summary.failures.push({ case: result.id, ...result.failure });
}
summary.truncatedFailures = Math.max(0, summary.failures.length - 20);
summary.failures = summary.failures.slice(0, 20);
const summaryFile = process.env.MATRIX_SUMMARY_FILE;
if (summaryFile) {
  await mkdir(path.dirname(path.resolve(summaryFile)), { recursive: true });
  const temporaryFile = `${summaryFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(summary)}\n`);
  await rename(temporaryFile, summaryFile);
}
const displaySummary = Object.fromEntries(
  Object.entries(summary).filter(([key]) => key !== 'caseIds' && key !== 'caseOutcomes'),
);
process.stdout.write(`${JSON.stringify(displaySummary)}\n`);
if (summary.failed || failedWorkers || records.size !== cases.length) process.exitCode = 1;
