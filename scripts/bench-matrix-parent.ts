import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const templateIds = ['name-keychain', 'articulated-name', 'nameplate', 'plant-label'] as const;
const concurrency = Math.max(1, Number.parseInt(process.env.MATRIX_CONCURRENCY ?? '2', 10) || 2);
const worker = fileURLToPath(new URL('./bench-matrix.ts', import.meta.url));
type MatrixSummary = {
  cases: number;
  passed: number;
  expectedInvalid: number;
  failed: number;
  warnings: Record<string, number>;
  byTemplate: Record<
    string,
    { cases: number; passed: number; expectedInvalid: number; failed: number }
  >;
  failures: Array<{ case: string; reason: string; issues: string[] }>;
  truncatedFailures: number;
  durationMs?: number;
  templateId?: string;
  durationsMs?: Record<string, number>;
};
const summaries: MatrixSummary[] = [];

const runTemplate = (templateId: (typeof templateIds)[number]) =>
  new Promise<MatrixSummary | undefined>((resolve) => {
    const startedAt = performance.now();
    const child = spawn(process.execPath, ['--import', 'tsx', worker], {
      cwd: process.cwd(),
      env: { ...process.env, MATRIX_TEMPLATE: templateId },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', () => resolve(undefined));
    child.on('close', (status) => {
      process.stdout.write(output);
      const lastLine = output.trim().split('\n').at(-1);
      if (!lastLine) {
        resolve(undefined);
        return;
      }
      try {
        const summary = JSON.parse(lastLine) as MatrixSummary;
        summary.durationMs = Math.round(performance.now() - startedAt);
        summary.templateId = templateId;
        if (status !== 0) summary.failed = Math.max(1, summary.failed);
        resolve(summary);
      } catch {
        resolve(undefined);
      }
    });
  });

const results: Array<MatrixSummary | undefined> = [];
let nextTemplate = 0;
const workerPromises = Array.from(
  { length: Math.min(concurrency, templateIds.length) },
  async () => {
    while (nextTemplate < templateIds.length) {
      const templateId = templateIds[nextTemplate++];
      results.push(await runTemplate(templateId));
    }
  },
);
await Promise.all(workerPromises);
for (const summary of results) {
  if (summary) summaries.push(summary);
  else process.exitCode = 1;
}

const combined = summaries.reduce<MatrixSummary>(
  (total, summary) => {
    total.cases += summary.cases;
    total.passed += summary.passed;
    total.expectedInvalid += summary.expectedInvalid;
    total.failed += summary.failed;
    total.truncatedFailures += summary.truncatedFailures;
    for (const [code, count] of Object.entries(summary.warnings))
      total.warnings[code] = (total.warnings[code] ?? 0) + count;
    Object.assign(total.byTemplate, summary.byTemplate);
    total.failures.push(...summary.failures);
    if (summary.templateId && summary.durationMs !== undefined)
      (total.durationsMs ??= {})[summary.templateId] = summary.durationMs;
    return total;
  },
  {
    cases: 0,
    passed: 0,
    expectedInvalid: 0,
    failed: 0,
    warnings: {},
    byTemplate: {},
    failures: [],
    truncatedFailures: 0,
    durationsMs: {},
  },
);

console.log(JSON.stringify(combined));
if (combined.failed || summaries.length !== templateIds.length) process.exitCode = 1;
