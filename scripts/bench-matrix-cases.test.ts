import { describe, expect, it } from 'vitest';

import {
  EXPECTED_MATRIX_CASE_COUNT,
  listMatrixCases,
  partitionMatrixCases,
  partitionMatrixCasesByShard,
  selectMatrixBenchmarkSample,
} from './bench-matrix-cases';

describe('geometry matrix scheduling', () => {
  it('keeps the full supported case count and stable unique IDs', () => {
    const cases = listMatrixCases();
    expect(cases).toHaveLength(EXPECTED_MATRIX_CASE_COUNT);
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
    const counts = new Map<string, number>();
    for (const item of cases) counts.set(item.templateId, (counts.get(item.templateId) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      'name-keychain': 1484,
      'articulated-name': 27,
      nameplate: 212,
      'plant-label': 1060,
      magnet: 1484,
    });
  });

  it('partitions deterministically without dropping or duplicating cases', () => {
    const cases = listMatrixCases();
    const packages = partitionMatrixCases(cases, 4);
    expect(packages.map((item) => item.packageId)).toEqual(packages.map((_, index) => index));
    expect(packages.every((item) => item.cases.length <= 4)).toBe(true);
    const flattened = packages.flatMap((item) => item.cases);
    expect(flattened.map((item) => item.id)).toEqual(cases.map((item) => item.id));
    expect(new Set(flattened.map((item) => item.id)).size).toBe(cases.length);
    expect(
      partitionMatrixCases(cases, 4).map((item) => item.cases.map((testCase) => testCase.id)),
    ).toEqual(packages.map((item) => item.cases.map((testCase) => testCase.id)));
  });

  it('distributes the complete matrix deterministically across shards', () => {
    const cases = listMatrixCases();
    const shards = Array.from({ length: 8 }, (_, index) =>
      partitionMatrixCasesByShard(cases, index, 8),
    );
    const flattened = shards.flat();
    expect(flattened).toHaveLength(cases.length);
    expect(new Set(flattened.map((item) => item.id)).size).toBe(cases.length);
    expect(flattened.map((item) => item.id).sort()).toEqual(cases.map((item) => item.id).sort());
    expect(shards.map((shard) => shard.length)).toEqual(
      Array.from({ length: 8 }, (_, index) => partitionMatrixCasesByShard(cases, index, 8).length),
    );
    expect(
      Math.max(...shards.map((shard) => shard.length)) -
        Math.min(...shards.map((shard) => shard.length)),
    ).toBeLessThanOrEqual(5);
    for (const templateId of new Set(cases.map((item) => item.templateId))) {
      const perShard = shards.map(
        (shard) => shard.filter((item) => item.templateId === templateId).length,
      );
      expect(Math.max(...perShard) - Math.min(...perShard)).toBeLessThanOrEqual(1);
    }
  });

  it('selects an exact, stable benchmark sample that represents every template', () => {
    const cases = listMatrixCases();
    const first = selectMatrixBenchmarkSample(cases, 100);
    const second = selectMatrixBenchmarkSample(cases, 100);
    expect(first).toHaveLength(100);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(new Set(first.map((item) => item.templateId))).toEqual(
      new Set(cases.map((item) => item.templateId)),
    );
    expect(new Set(first.map((item) => item.id)).size).toBe(100);
  });
});
