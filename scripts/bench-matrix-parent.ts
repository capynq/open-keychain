import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const templateIds = ['name-keychain', 'articulated-name', 'nameplate', 'plant-label'] as const;
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
};
const summaries: MatrixSummary[] = [];

const runTemplate = (templateId: (typeof templateIds)[number]) =>
  new Promise<MatrixSummary | undefined>((resolve) => {
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
    child.on('close', () => {
      process.stdout.write(output);
      const lastLine = output.trim().split('\n').at(-1);
      if (!lastLine) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(lastLine) as MatrixSummary);
      } catch {
        resolve(undefined);
      }
    });
  });

const results = await Promise.all(templateIds.map(runTemplate));
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
  },
);

console.log(JSON.stringify(combined));
if (combined.failed || summaries.length !== templateIds.length) process.exitCode = 1;
