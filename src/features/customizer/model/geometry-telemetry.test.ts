import { describe, expect, it } from 'vitest';

import {
  attributeAdoptedBoot,
  createColdPreviewTracker,
  geometryReadyTimingProperties,
  previewRenderedProperties,
  workerReplacementCount,
} from './geometry-telemetry';

const adopt = (
  lastReportedBootId: number | undefined,
  bootId: number,
  overrides: { active?: boolean; cacheHit?: boolean } = {},
) =>
  attributeAdoptedBoot({
    active: overrides.active ?? true,
    lastReportedBootId,
    info: { bootId, workerBootMs: 850.4 },
    cacheHit: overrides.cacheHit ?? false,
  });

describe('worker replacement telemetry', () => {
  it('clamps the replacement count to the telemetry maximum of 20', () => {
    expect(workerReplacementCount(undefined)).toBeUndefined();
    expect(workerReplacementCount(2)).toBe(2);
    expect(workerReplacementCount(20)).toBe(20);
    expect(workerReplacementCount(35)).toBe(20);
  });
});

describe('adopted boot attribution', () => {
  it('marks the first adopted success after a boot cold, then the next one warm', () => {
    const first = adopt(undefined, 1);
    expect(first.boot).toEqual({ coldStart: true, workerBootMs: 850.4 });
    const second = adopt(first.reportedBootId, 1);
    expect(second.boot).toEqual({ coldStart: false });
    expect(second.reportedBootId).toBe(1);
  });

  it('marks the first adopted success after a re-boot cold again', () => {
    expect(adopt(1, 2).boot.coldStart).toBe(true);
  });

  it('does not consume the cold flag for dropped or cached results', () => {
    const dropped = adopt(undefined, 1, { active: false });
    expect(dropped.boot.coldStart).toBe(false);
    expect(dropped.reportedBootId).toBeUndefined();
    const cached = adopt(undefined, 1, { cacheHit: true });
    expect(cached.boot.coldStart).toBe(false);
    expect(cached.reportedBootId).toBeUndefined();
    expect(adopt(cached.reportedBootId, 1).boot.coldStart).toBe(true);
  });

  it('treats a missing client boot identity as warm', () => {
    expect(
      attributeAdoptedBoot({
        active: true,
        lastReportedBootId: undefined,
        info: undefined,
        cacheHit: false,
      }).boot,
    ).toEqual({ coldStart: false });
  });
});

describe('geometry telemetry mapping', () => {
  it('maps geometry timings and boot attribution to rounded geometry_ready properties', () => {
    expect(
      geometryReadyTimingProperties(
        {
          wasmWaitMs: 12.4,
          workerComputeMs: 339.6,
          clientRoundTripMs: 380,
          clientQueueMs: Number.NaN,
        },
        { coldStart: true, workerBootMs: 1200.5 },
      ),
    ).toEqual({
      wasm_wait_ms: 12,
      worker_compute_ms: 340,
      client_round_trip_ms: 380,
      client_queue_ms: undefined,
      worker_boot_ms: 1201,
      cache_hit: false,
      cold_start: true,
    });
  });

  it('always reports cache_hit and cold_start as booleans on a successful attempt', () => {
    expect(geometryReadyTimingProperties({ clientCacheHit: 1 }, { coldStart: false })).toEqual({
      cache_hit: true,
      cold_start: false,
    });
    expect(geometryReadyTimingProperties(undefined, undefined)).toEqual({
      cache_hit: false,
      cold_start: false,
    });
  });

  it('maps viewer render timings to preview_rendered properties', () => {
    expect(
      previewRenderedProperties(14, 'heart', {
        meshSetupMs: 7.6,
        drawSubmitMs: 2.2,
        initializationMs: 450,
      }),
    ).toEqual({
      geometry_generation_id: 14,
      template: 'heart',
      mesh_setup_ms: 8,
      draw_submit_ms: 2,
      initialization_ms: 450,
      cold_start: true,
    });
  });
});

describe('cold preview tracker', () => {
  const timings = { meshSetupMs: 1, drawSubmitMs: 1 };

  it('emits once for the cold generation and never for warm ones', () => {
    const tracker = createColdPreviewTracker();
    tracker.markCold(5, 'heart');
    expect(tracker.rendered(4, timings)).toBeUndefined();
    expect(tracker.rendered(5, timings)).toMatchObject({
      geometry_generation_id: 5,
      template: 'heart',
    });
    expect(tracker.rendered(5, timings)).toBeUndefined();
    tracker.markCold(6, 'heart');
    expect(tracker.rendered(6, timings)).toBeDefined();

    const warm = createColdPreviewTracker();
    expect(warm.rendered(7, timings)).toBeUndefined();
  });

  it('keeps a cold generation pending across newer attempts until it renders', () => {
    const tracker = createColdPreviewTracker();
    tracker.markCold(8, 'name-keychain');
    expect(tracker.rendered(9, timings)).toBeUndefined();
    expect(tracker.rendered(8, timings)).toMatchObject({ geometry_generation_id: 8 });
  });

  it('lets a newer cold boot replace the pending cold generation', () => {
    const tracker = createColdPreviewTracker();
    tracker.markCold(8, 'name-keychain');
    tracker.markCold(9, 'magnet');
    expect(tracker.rendered(8, timings)).toBeUndefined();
    expect(tracker.rendered(9, timings)).toMatchObject({ geometry_generation_id: 9 });
  });
});
