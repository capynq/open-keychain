import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listMatrixCases, partitionMatrixCasesByShard } from './bench-matrix-cases';
import {
  EXPECTED_MATRIX_CASE_COUNT,
  EXPECTED_MATRIX_INVALID_COUNT,
  MATRIX_SHARD_COUNT,
  MATRIX_SHARD_TARGET_MS,
} from './matrix-contract';

export type MatrixShardSummary = {
  schema: 'geometry-matrix-summary.v1';
  mode: 'shard';
  cases: number;
  fullCaseCount: number;
  passed: number;
  expectedInvalid: number;
  failed: number;
  durationsMs: { total: number };
  shardIndex: number;
  shardCount: number;
  caseIds: string[];
};

export const validateMatrixShardSummaries = (
  summaries: MatrixShardSummary[],
  expectedCaseIds = listMatrixCases().map((item) => item.id),
  shardCount = MATRIX_SHARD_COUNT,
) => {
  if (summaries.length !== shardCount)
    throw new Error(
      `Expected ${shardCount} geometry shard summaries, received ${summaries.length}.`,
    );
  if (expectedCaseIds.length !== EXPECTED_MATRIX_CASE_COUNT)
    throw new Error(`Expected case manifest to contain ${EXPECTED_MATRIX_CASE_COUNT} IDs.`);
  if (new Set(expectedCaseIds).size !== expectedCaseIds.length)
    throw new Error('Expected case manifest contains duplicate IDs.');

  const byIndex = new Map<number, MatrixShardSummary>();
  for (const summary of summaries) {
    if (
      summary.schema !== 'geometry-matrix-summary.v1' ||
      summary.mode !== 'shard' ||
      summary.shardCount !== shardCount ||
      !Number.isInteger(summary.shardIndex) ||
      summary.shardIndex < 0 ||
      summary.shardIndex >= shardCount
    )
      throw new Error('Geometry shard summary has an unsupported or inconsistent schema.');
    if (byIndex.has(summary.shardIndex))
      throw new Error(`Duplicate geometry shard index ${summary.shardIndex}.`);
    if (summary.cases !== summary.caseIds.length)
      throw new Error(
        `Geometry shard ${summary.shardIndex} case count does not match its ID list.`,
      );
    if (
      !Number.isInteger(summary.passed) ||
      summary.passed < 0 ||
      !Number.isInteger(summary.expectedInvalid) ||
      summary.expectedInvalid < 0 ||
      !Number.isInteger(summary.failed) ||
      summary.failed < 0
    )
      throw new Error(`Geometry shard ${summary.shardIndex} has invalid outcome counters.`);
    if (summary.fullCaseCount !== expectedCaseIds.length)
      throw new Error(`Geometry shard ${summary.shardIndex} used a different full case manifest.`);
    if (
      summary.failed > 0 ||
      summary.passed + summary.expectedInvalid + summary.failed !== summary.cases
    )
      throw new Error(`Geometry shard ${summary.shardIndex} did not pass every assigned case.`);
    if (!Number.isFinite(summary.durationsMs.total) || summary.durationsMs.total < 0)
      throw new Error(`Geometry shard ${summary.shardIndex} has an invalid duration.`);
    byIndex.set(summary.shardIndex, summary);
  }
  for (let index = 0; index < shardCount; index += 1)
    if (!byIndex.has(index)) throw new Error(`Missing geometry shard ${index}.`);

  const seen = new Set<string>();
  for (const summary of byIndex.values()) {
    const assignedIds = new Set(
      partitionMatrixCasesByShard(listMatrixCases(), summary.shardIndex, shardCount).map(
        (item) => item.id,
      ),
    );
    for (const caseId of summary.caseIds) {
      if (seen.has(caseId)) throw new Error(`Duplicate geometry case result: ${caseId}.`);
      if (!assignedIds.has(caseId))
        throw new Error(
          `Geometry shard ${summary.shardIndex} contains an incorrectly assigned case.`,
        );
      seen.add(caseId);
    }
  }
  const expected = new Set(expectedCaseIds);
  const missing = [...expected].filter((caseId) => !seen.has(caseId));
  const unexpected = [...seen].filter((caseId) => !expected.has(caseId));
  if (missing.length || unexpected.length)
    throw new Error(
      `Geometry shard coverage mismatch: ${missing.length} missing, ${unexpected.length} unexpected case IDs.`,
    );

  const ordered = [...byIndex.values()].sort((left, right) => left.shardIndex - right.shardIndex);
  const totals = ordered.reduce(
    (result, item) => ({
      cases: result.cases + item.cases,
      passed: result.passed + item.passed,
      expectedInvalid: result.expectedInvalid + item.expectedInvalid,
      failed: result.failed + item.failed,
    }),
    { cases: 0, passed: 0, expectedInvalid: 0, failed: 0 },
  );
  if (totals.cases !== EXPECTED_MATRIX_CASE_COUNT)
    throw new Error(
      `Geometry matrix completed ${totals.cases}/${EXPECTED_MATRIX_CASE_COUNT} cases.`,
    );
  if (totals.expectedInvalid !== EXPECTED_MATRIX_INVALID_COUNT)
    throw new Error(
      `Expected ${EXPECTED_MATRIX_INVALID_COUNT} expected-invalid cases, received ${totals.expectedInvalid}.`,
    );
  const elapsedMs = Math.max(...ordered.map((item) => item.durationsMs.total));
  if (elapsedMs > MATRIX_SHARD_TARGET_MS)
    throw new Error(
      `Full geometry matrix took ${(elapsedMs / 1000).toFixed(1)}s; target is ${MATRIX_SHARD_TARGET_MS / 1000}s.`,
    );
  return { ...totals, shardCount, elapsedMs, targetMs: MATRIX_SHARD_TARGET_MS };
};

const main = async () => {
  const summaryDirectory = process.argv[2];
  if (!summaryDirectory) throw new Error('Pass the directory containing geometry shard summaries.');
  const files = (await readdir(summaryDirectory)).filter((name) => /^shard-\d+\.json$/.test(name));
  const summaries = await Promise.all(
    files.map(
      async (name) =>
        JSON.parse(await readFile(path.join(summaryDirectory, name), 'utf8')) as MatrixShardSummary,
    ),
  );
  const result = validateMatrixShardSummaries(summaries);
  process.stdout.write(`Full geometry matrix passed: ${JSON.stringify(result)}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
