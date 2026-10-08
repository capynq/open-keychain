import { describe, expect, it } from 'vitest';

import { listMatrixCases, partitionMatrixCasesByShard } from './bench-matrix-cases';
import {
  EXPECTED_MATRIX_INVALID_COUNT,
  MATRIX_SHARD_COUNT,
  MATRIX_SHARD_TARGET_MS,
} from './matrix-contract';
import { validateMatrixShardSummaries, type MatrixShardSummary } from './validate-matrix-shards';

const fixtureSummaries = (durationMs = 240_000): MatrixShardSummary[] => {
  const cases = listMatrixCases();
  return Array.from({ length: MATRIX_SHARD_COUNT }, (_, shardIndex) => {
    const caseIds = partitionMatrixCasesByShard(cases, shardIndex, MATRIX_SHARD_COUNT).map(
      (item) => item.id,
    );
    const expectedInvalid = shardIndex === 0 ? EXPECTED_MATRIX_INVALID_COUNT : 0;
    return {
      schema: 'geometry-matrix-summary.v1',
      mode: 'shard',
      cases: caseIds.length,
      fullCaseCount: cases.length,
      passed: caseIds.length - expectedInvalid,
      expectedInvalid,
      failed: 0,
      durationsMs: { total: durationMs },
      shardIndex,
      shardCount: MATRIX_SHARD_COUNT,
      caseIds,
    };
  });
};

describe('geometry shard result aggregation', () => {
  it('accepts all full-coverage shard results under the five-minute target', () => {
    const result = validateMatrixShardSummaries(fixtureSummaries());
    expect(result).toMatchObject({
      cases: 4267,
      passed: 4264,
      expectedInvalid: 3,
      failed: 0,
      shardCount: 8,
      elapsedMs: 240_000,
      targetMs: MATRIX_SHARD_TARGET_MS,
    });
  });

  it('rejects missing shards, duplicate cases, and incomplete coverage', () => {
    expect(() => validateMatrixShardSummaries(fixtureSummaries().slice(1))).toThrow(
      'Expected 8 geometry shard summaries',
    );
    const duplicate = fixtureSummaries();
    duplicate[1].caseIds[0] = duplicate[0].caseIds[0];
    expect(() => validateMatrixShardSummaries(duplicate)).toThrow('Duplicate geometry case result');
    const missing = fixtureSummaries();
    missing[0].caseIds.pop();
    missing[0].cases -= 1;
    missing[0].passed -= 1;
    expect(() => validateMatrixShardSummaries(missing)).toThrow('coverage mismatch');
  });

  it('rejects a complete but incorrectly assigned shard set', () => {
    const incorrectlyAssigned = fixtureSummaries();
    const firstId = incorrectlyAssigned[0].caseIds[0];
    const secondId = incorrectlyAssigned[1].caseIds[0];
    incorrectlyAssigned[0].caseIds[0] = secondId;
    incorrectlyAssigned[1].caseIds[0] = firstId;
    expect(() => validateMatrixShardSummaries(incorrectlyAssigned)).toThrow(
      'incorrectly assigned case',
    );
  });

  it('rejects any failed shard or matrix runtime above five minutes', () => {
    const failed = fixtureSummaries();
    failed[2].failed = 1;
    failed[2].passed -= 1;
    expect(() => validateMatrixShardSummaries(failed)).toThrow('did not pass every assigned case');
    expect(() => validateMatrixShardSummaries(fixtureSummaries(300_001))).toThrow('target is 300s');
  });
});
