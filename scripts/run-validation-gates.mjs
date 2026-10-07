import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { clearTimeout, setTimeout } from 'node:timers';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  clearValidationCache,
  fingerprintGate,
  pruneValidationCache,
  readSuccessfulResult,
  restoreBuildArtifact,
  saveSuccessfulResult,
} from './validation-cache.mjs';
import { ValidationUi, eventFor } from './validation-ui.mjs';
import { createGatePlan } from './validation-plan.mjs';
import {
  collectPushChanges,
  assertCleanValidationInputs,
  withCleanValidationWorkspace,
} from './validation-git.mjs';

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'artifacts', 'validation-logs');
const MAX_CONCURRENCY = Math.max(1, Math.min(8, os.availableParallelism?.() ?? os.cpus().length));
const DEFAULT_CONCURRENCY = Math.min(2, MAX_CONCURRENCY);
const parseConcurrency = (raw) => {
  const value = raw ?? String(DEFAULT_CONCURRENCY);
  if (!/^[1-9]\d*$/.test(value) || Number(value) > MAX_CONCURRENCY)
    throw new Error(
      `VALIDATION_CONCURRENCY must be a finite positive integer <= ${MAX_CONCURRENCY}; received ${value}`,
    );
  return Number(value);
};

const COMMON_INPUTS = [
  'package.json',
  'pnpm-lock.yaml',
  'scripts/run-validation-gates.mjs',
  'scripts/validation-plan.mjs',
  'scripts/validation-cache.mjs',
  'scripts/validation-git.mjs',
  'scripts/validation-vitest-reporter.mjs',
  'scripts/validation-playwright-reporter.mjs',
  'scripts/validate-changed.mjs',
];
const terminateProcessTree = (child) => {
  const signal = (name) => {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, name);
      else child.kill(name);
    } catch {
      try {
        child.kill(name);
      } catch {
        /* the child already exited */
      }
    }
  };
  signal('SIGTERM');
  const forceKill = setTimeout(() => signal('SIGKILL'), 5000);
  forceKill.unref();
  child.once('close', () => clearTimeout(forceKill));
};
const isGeometryInput = (file) =>
  file.startsWith('src/domain/keychain/') ||
  file.startsWith('src/entities/keychain/') ||
  file.startsWith('src/infrastructure/geometry/') ||
  file.startsWith('src/infrastructure/export/') ||
  file.startsWith('public/fonts/') ||
  ['public/manifold.wasm', 'public/manifold-v1.wasm'].includes(file) ||
  file.startsWith('scripts/bench-') ||
  file.startsWith('scripts/generate-validation-fixtures');
export const validationInputsForGate = (gate, allInputs, changedFiles = []) => {
  const config = [...COMMON_INPUTS];
  if (gate.id.startsWith('format'))
    return [...new Set([...changedFiles, ...config, 'prettier.config.js'])];
  if (gate.id.startsWith('lint'))
    return [...new Set([...changedFiles, ...config, 'eslint.config.js'])];
  if (gate.id === 'typecheck')
    return allInputs.filter(
      (file) =>
        /\.[cm]?tsx?$/.test(file) ||
        ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', ...config].includes(file),
    );
  if (gate.id.startsWith('unit'))
    return allInputs.filter(
      (file) =>
        file.startsWith('src/') ||
        file.startsWith('scripts/') ||
        file.startsWith('public/') ||
        file.startsWith('tests/fixtures/') ||
        ['vitest.config.ts', 'tsconfig.json', ...config].includes(file),
    );
  if (gate.id === 'build')
    return allInputs.filter(
      (file) =>
        (file.startsWith('src/') && !/\.(?:test|spec)\.[^.]+$/.test(file)) ||
        file.startsWith('public/') ||
        file.startsWith('assets/') ||
        file.startsWith('.env') ||
        file === 'index.html' ||
        [
          'vite.config.ts',
          'postcss.config.js',
          'scripts/seo-sitemap.ts',
          'scripts/generate-seo-sitemap.ts',
          ...config,
        ].includes(file),
    );
  if (gate.id === 'browser')
    return allInputs.filter(
      (file) =>
        file.startsWith('e2e/') ||
        file.startsWith('src/') ||
        file.startsWith('public/') ||
        file.startsWith('.env') ||
        [
          'index.html',
          'vite.config.ts',
          'playwright.config.ts',
          'playwright.dev-boot.config.ts',
          ...config,
        ].includes(file),
    );
  if (gate.id === 'geometry')
    return allInputs.filter(
      (file) =>
        isGeometryInput(file) || ['vitest.config.ts', 'tsconfig.json', ...config].includes(file),
    );
  return [...new Set([...changedFiles, ...config])];
};

export const runValidationGates = async (
  inputGates,
  {
    concurrency = parseConcurrency(process.env.VALIDATION_CONCURRENCY),
    files = [],
    profile = 'full',
    mode = process.env.VALIDATION_UI ?? 'auto',
    branch = process.env.VALIDATION_BRANCH ?? 'local',
    sha = process.env.VALIDATION_SHA ?? 'working-tree',
    cache = process.env.VALIDATION_CACHE !== '0',
    failFast = profile !== 'ci',
  } = {},
) => {
  const limit =
    typeof concurrency === 'number' ? concurrency : parseConcurrency(String(concurrency));
  if (!Number.isInteger(limit) || limit < 1 || limit > 8)
    throw new Error('Validation concurrency must be an integer from 1 to 8.');
  await mkdir(LOG_DIR, { recursive: true });
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
  const logPath = path.join(LOG_DIR, `${runId}.log`);
  const runLogStream = createWriteStream(logPath, { flags: 'a' });
  const ui = new ValidationUi({
    profile,
    branch,
    sha,
    changedCount: files.length,
    gates: inputGates,
    logDir: logPath,
    mode,
  });
  await ui.start();
  const gates = inputGates.map((gate) => ({ ...gate, id: gate.id ?? gate.name, status: 'queued' }));
  for (const gate of gates)
    gate.workerSlots = Math.min(
      limit,
      Math.max(1, Number.isInteger(gate.workerSlots) ? gate.workerSlots : 1),
    );
  const rootEntries = await readdir(ROOT);
  const envInputs = rootEntries.filter(
    (file) => file.startsWith('.env') && file !== '.env.example',
  );
  const allInputs = [
    ...execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean),
    ...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean),
    ...execFileSync(
      'git',
      [
        'ls-files',
        '--others',
        '--ignored',
        '--exclude-standard',
        '-z',
        '--',
        'src',
        'public',
        'e2e',
        'scripts',
        'tests',
        'tools',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean),
    ...envInputs,
  ];
  const results = new Map();
  const running = new Map();
  const slowestCases = [];
  let stopping = false;
  let userSkipped = false;
  const emit = (gateId, status, values = {}) => {
    const event = eventFor(runId, gateId, status, values);
    ui.handle(event);
    runLogStream.write(`${JSON.stringify(event)}\n`);
  };
  const stopAll = () => {
    stopping = true;
    for (const gate of gates) {
      if (gate.status !== 'running') continue;
      const child = gate.child;
      if (!child || child.killed) continue;
      terminateProcessTree(child);
    }
  };
  const handleSignal = () => {
    stopAll();
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
  ui.onCancel = stopAll;
  ui.onSkip = (id) => {
    const gate = gates.find((candidate) => candidate.id === id);
    const requiredDependent = gates.some(
      (candidate) => candidate.required && candidate.dependsOn?.includes(id),
    );
    if (!gate || gate.required || requiredDependent) {
      ui.handle({
        gateId: id,
        status: 'diagnostic',
        message: 'This gate is required by the selected profile and cannot be skipped.',
      });
      return;
    }
    userSkipped = true;
    gate.skipRequested = true;
    const child = gate.child;
    if (child) terminateProcessTree(child);
  };
  emit('validation', 'run-started', {
    profile,
    gateCount: gates.length,
    changedCount: files.length,
  });
  const statusEvent = (gate, status, values) => emit(gate.id, status, values);

  const execute = async (gate) => {
    const startedAt = Date.now();
    const gateLog = path.join(LOG_DIR, `${runId}-${gate.id.replaceAll(':', '_')}.log`);
    gate.logPath = gateLog;
    const cacheable = gate.cacheable !== false;
    let key;
    if (cache && cacheable) {
      const inputFiles = gate.inputFiles ?? validationInputsForGate(gate, allInputs, files);
      key = await fingerprintGate({
        root: ROOT,
        gate,
        inputFiles,
      });
      const hit = await readSuccessfulResult({ root: ROOT, gateId: gate.id, key });
      if (hit.hit) {
        if (gate.id === 'build') {
          const restored = await restoreBuildArtifact({ root: ROOT, cachedResult: hit });
          if (!restored.restored)
            emit(gate.id, 'diagnostic', {
              message: `[build] cached artifact unavailable; running build`,
            });
          else {
            statusEvent(gate, 'gate-cache-hit', { reason: 'verified artifact restored' });
            return { id: gate.id, ok: true, status: 'cached', durationMs: 0, cached: true };
          }
        } else {
          statusEvent(gate, 'gate-cache-hit', { reason: 'inputs and environment match' });
          return { id: gate.id, ok: true, status: 'cached', durationMs: 0, cached: true };
        }
      } else {
        statusEvent(gate, 'gate-cache-miss', { reason: hit.reason });
        if (process.env.VALIDATION_VERBOSE === '1')
          emit(gate.id, 'diagnostic', { message: `[${gate.id}] cache miss: ${hit.reason}` });
      }
    } else {
      statusEvent(gate, 'gate-cache-miss', {
        reason: cache ? 'gate is not cacheable' : 'cache bypassed',
      });
    }
    if (gate.skipRequested) {
      statusEvent(gate, 'gate-skipped');
      return { id: gate.id, ok: true, status: 'skipped', durationMs: Date.now() - startedAt };
    }
    if (stopping) {
      statusEvent(gate, 'gate-cancelled', { detail: 'validation cancelled before start' });
      return { id: gate.id, ok: false, status: 'cancelled', durationMs: Date.now() - startedAt };
    }
    statusEvent(gate, 'gate-started', { detail: gate.phase ?? gate.name, logPath: gateLog });
    const shell = process.platform === 'win32';
    const child = spawn(gate.command, gate.args ?? [], {
      cwd: ROOT,
      shell,
      env: {
        ...process.env,
        ...(gate.env ?? {}),
        ...(['browser', 'geometry'].includes(gate.id) || gate.id.startsWith('unit')
          ? { VALIDATION_EVENTS: '1', VALIDATION_GATE_ID: gate.id }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !shell,
    });
    gate.child = child;
    running.set(gate.id, child);
    const logStream = createWriteStream(gateLog, { flags: 'a' });
    logStream.on('error', (error) =>
      emit(gate.id, 'diagnostic', {
        message: `[${gate.name}] cannot write full log: ${error.message}`,
      }),
    );
    let tail = '';
    let eventBuffer = '';
    const stream = (chunk, stderr, source) => {
      const data = chunk.toString();
      if (!logStream.write(data)) {
        source.pause();
        logStream.once('drain', () => source.resume());
      }
      tail = (tail + data).slice(-8000);
      if (!stderr) {
        eventBuffer += data;
        const lines = eventBuffer.split('\n');
        eventBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('\u001e')) continue;
          try {
            const event = JSON.parse(line.slice(1));
            ui.handle(eventFor(runId, event.gateId ?? gate.id, event.status, event));
            if (event.status === 'case-completed' && Number.isFinite(event.durationMs)) {
              slowestCases.push({
                gate: event.gateId ?? gate.id,
                name: event.name,
                durationMs: event.durationMs,
              });
              slowestCases.sort((left, right) => right.durationMs - left.durationMs);
              slowestCases.length = Math.min(10, slowestCases.length);
            }
          } catch {
            /* ignore malformed reporter events */
          }
        }
      }
      if (stderr && data.trim())
        for (const line of data.trim().split(/\r?\n/).slice(-3))
          emit(gate.id, 'diagnostic', { message: `[${gate.name}] ${line.slice(0, 500)}` });
      if (gate.id === 'geometry') {
        const match = data.match(/\b(\d+)\s+passed\b/g);
        if (match)
          emit(gate.id, 'gate-progress', {
            completed: Number(match.at(-1).match(/\d+/)[0]),
            detail: 'matrix running',
          });
      }
    };
    child.stdout.on('data', (chunk) => stream(chunk, false, child.stdout));
    child.stderr.on('data', (chunk) => stream(chunk, true, child.stderr));
    const result = await new Promise((resolve) => {
      child.once('error', (error) => resolve({ status: 1, error }));
      child.once('close', (status, signal) => resolve({ status: status ?? 1, signal }));
    });
    await new Promise((resolve) => logStream.end(resolve));
    const durationMs = Date.now() - startedAt;
    if (gate.skipRequested) {
      statusEvent(gate, 'gate-skipped');
      return { id: gate.id, ok: true, status: 'skipped', durationMs, tail };
    }
    if (stopping && result.status !== 0) {
      statusEvent(gate, 'gate-cancelled', { detail: 'validation cancelled' });
      return { id: gate.id, ok: false, status: 'cancelled', durationMs, tail };
    }
    if (result.status === 0 && cache && cacheable) {
      const artifactPath = gate.id === 'build' ? path.join(ROOT, 'dist') : undefined;
      await saveSuccessfulResult({ root: ROOT, gate, key, durationMs, artifactPath });
    }
    statusEvent(gate, 'gate-completed', {
      ok: result.status === 0,
      detail:
        result.status === 0
          ? 'passed'
          : result.signal
            ? `terminated (${result.signal})`
            : `exit ${result.status}`,
      durationMs,
    });
    return {
      ...result,
      id: gate.id,
      ok: result.status === 0,
      status: result.status === 0 ? 'passed' : 'failed',
      durationMs,
      tail,
    };
  };

  try {
    for (const gate of gates) statusEvent(gate, 'gate-queued');
    while (results.size < gates.length) {
      let madeProgress = false;
      for (const gate of gates) {
        if (gate.status !== 'queued') continue;
        const dependencies = gate.dependsOn ?? [];
        if (
          dependencies.some((dependency) => results.has(dependency) && !results.get(dependency).ok)
        ) {
          gate.status = 'blocked';
          results.set(gate.id, { id: gate.id, ok: false, status: 'blocked' });
          statusEvent(gate, 'gate-blocked', { detail: 'dependency failed, skipped, or cancelled' });
          madeProgress = true;
          continue;
        }
        if (
          stopping ||
          (failFast &&
            [...results.values()].some((result) => !result.ok && result.status !== 'skipped'))
        ) {
          gate.status = 'blocked';
          results.set(gate.id, { id: gate.id, ok: false, status: 'blocked' });
          statusEvent(gate, 'gate-blocked', { detail: 'fail-fast stopped new gates' });
          madeProgress = true;
          continue;
        }
        if (gate.skipRequested) {
          gate.status = 'skipped';
          results.set(gate.id, { id: gate.id, ok: true, status: 'skipped' });
          statusEvent(gate, 'gate-skipped');
          madeProgress = true;
          continue;
        }
        const activeSlots = gates
          .filter((item) => item.status === 'running')
          .reduce((sum, item) => sum + item.workerSlots, 0);
        if (
          dependencies.some((dependency) => !results.has(dependency)) ||
          activeSlots + gate.workerSlots > limit
        )
          continue;
        gate.status = 'running';
        const promise = execute(gate).then((result) => {
          results.set(gate.id, result);
          gate.status = result.status;
          running.delete(gate.id);
          if (failFast && !result.ok && result.status !== 'skipped') stopAll();
        });
        running.set(gate.id, undefined); // process handle is assigned once cache lookup completes
        gate.promise = promise;
        madeProgress = true;
      }
      if (running.size)
        await Promise.race(
          gates.filter((gate) => gate.promise && !results.has(gate.id)).map((gate) => gate.promise),
        );
      else if (!madeProgress && results.size < gates.length)
        throw new Error(
          `Validation plan has unresolved dependencies or a cycle (pending: ${gates
            .filter((gate) => gate.status === 'queued')
            .map((gate) => `${gate.id}[${(gate.dependsOn ?? []).join(',')}]`)
            .join(',')}; results: ${[...results.keys()].join(',')}).`,
        );
    }
  } catch (error) {
    stopAll();
    emit('validation', 'diagnostic', { message: error.message });
    await ui.close({ summary: 'Validation cancelled or failed' });
    await new Promise((resolve) => runLogStream.end(resolve));
    throw error;
  } finally {
    await Promise.allSettled(gates.map((gate) => gate.promise));
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
  }
  await pruneValidationCache({ root: ROOT });
  const values = [...results.values()];
  const failures = values.filter((result) => !result.ok && result.status !== 'skipped');
  const partial = userSkipped && profile === 'push' && failures.length === 0;
  emit('validation', 'final-summary', {
    ok: failures.length === 0,
    partial,
    passed: values.filter((result) => result.status === 'passed').length,
    cached: values.filter((result) => result.status === 'cached').length,
    failed: failures.length,
    skipped: values.filter((result) => result.status === 'skipped').length,
  });
  await ui.close({
    summary: failures.length
      ? `Validation failed: ${failures.map((result) => result.id).join(', ')}`
      : partial
        ? 'Quick checks passed'
        : 'Validation passed',
    partial,
  });
  await new Promise((resolve) => runLogStream.end(resolve));
  process.stdout.write(
    `Gate results: ${values.map((result) => `${result.id}=${result.status}(${result.durationMs === undefined ? '—' : `${result.durationMs}ms`})`).join(' · ')}\n${slowestCases.length ? `Slowest cases: ${slowestCases.map((item) => `${item.gate}/${item.name}=${item.durationMs}ms`).join(' · ')}\n` : ''}Full logs: ${logPath}\n`,
  );
  return Object.assign(values, { results: values, ok: failures.length === 0, partial, logPath });
};

const parseMode = () => {
  const mode = process.env.VALIDATION_UI ?? 'auto';
  if (!['auto', 'tui', 'plain'].includes(mode))
    throw new Error(`VALIDATION_UI must be auto, tui, or plain (received ${mode}).`);
  return mode;
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'ci';
  if (command === 'cache-clear') {
    await clearValidationCache(ROOT);
    process.stdout.write('Validation cache cleared.\n');
    return;
  }
  let files;
  if (command === 'push' || command === 'bench-push') {
    const input =
      command === 'push'
        ? await (async () => {
            const chunks = [];
            if (!process.stdin.isTTY) for await (const chunk of process.stdin) chunks.push(chunk);
            return Buffer.concat(chunks).toString('utf8');
          })()
        : '';
    const executePush = async () => {
      let changes;
      if (command === 'push') {
        await assertCleanValidationInputs({ root: ROOT });
        changes = collectPushChanges({ hookInput: input, root: ROOT });
      } else {
        const working = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD'], {
          cwd: ROOT,
          encoding: 'utf8',
        })
          .split('\0')
          .filter(Boolean);
        const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
          cwd: ROOT,
          encoding: 'utf8',
        })
          .split('\0')
          .filter(Boolean);
        const untracked = execFileSync(
          'git',
          ['ls-files', '--others', '--exclude-standard', '-z'],
          {
            cwd: ROOT,
            encoding: 'utf8',
          },
        )
          .split('\0')
          .filter(Boolean);
        changes = {
          files: [...new Set([...working, ...staged, ...untracked])].sort(),
          branch: process.env.VALIDATION_BRANCH ?? 'benchmark',
          head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
          conservative: false,
        };
      }
      files = changes.files;
      const branch = changes.branch;
      const sha = changes.head.slice(0, 10);
      if (('deletedOnly' in changes && changes.deletedOnly) || files.length === 0) {
        process.stdout.write('No pushed file changes require validation.\n');
        return;
      }
      if (changes.conservative)
        process.stdout.write('Git baseline unavailable; using conservative full validation.\n');
      const gates = createGatePlan(files, changes.conservative ? 'full' : 'push');
      const outcome = await runValidationGates(gates, {
        files,
        profile: 'quick',
        branch,
        sha,
        mode: parseMode(),
      });
      process.exitCode = outcome.ok ? 0 : 1;
    };
    if (command === 'push') {
      await withCleanValidationWorkspace(
        {
          root: ROOT,
          onCleanup: ({ removedFinderFiles = [], isolatedEnvFiles = [] }) => {
            if (removedFinderFiles.length)
              process.stdout.write(`Removed Finder metadata: ${removedFinderFiles.join(', ')}\n`);
            if (isolatedEnvFiles.length)
              process.stdout.write(
                `Temporarily isolated local env files for validation (will restore): ${isolatedEnvFiles.join(', ')}\n`,
              );
          },
        },
        executePush,
      );
    } else await executePush();
    return;
  }
  const profile =
    command === 'full'
      ? 'full'
      : command === 'ci'
        ? 'ci'
        : command === 'ci-browser'
          ? 'ci-browser'
          : command === 'ci-geometry'
            ? 'ci-geometry'
            : command === 'bench-ui'
              ? 'bench-ui'
              : command === 'bench-geometry'
                ? 'bench-geometry'
                : command === 'bench-docs'
                  ? 'bench-docs'
                  : null;
  if (!profile) throw new Error(`Unknown validation profile: ${command}`);
  const tracked = (await import('node:child_process'))
    .execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  files = profile === 'ci' || profile === 'full' ? tracked : [];
  const gates = createGatePlan(files, profile);
  const outcome = await runValidationGates(gates, {
    files,
    profile,
    mode: parseMode(),
    failFast: profile !== 'ci',
  });
  process.exitCode = outcome.ok ? 0 : 1;
};

if (process.argv[1]?.endsWith('run-validation-gates.mjs')) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
