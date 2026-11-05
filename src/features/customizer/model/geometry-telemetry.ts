import type { AnalyticsProperties } from '@/infrastructure/telemetry/events';

export type GeometryBootAttribution = { coldStart: boolean; workerBootMs?: number };

const MAX_WORKER_REPLACEMENTS = 20;

type ViewerTimings = {
  meshSetupMs: number;
  drawSubmitMs: number;
  initializationMs?: number;
};

const roundedMs = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;

export const attributeAdoptedBoot = (input: {
  active: boolean;
  lastReportedBootId: number | undefined;
  info: { bootId: number; workerBootMs?: number } | undefined;
  cacheHit: boolean;
}): { boot: GeometryBootAttribution; reportedBootId: number | undefined } => {
  const warm = { boot: { coldStart: false }, reportedBootId: input.lastReportedBootId };
  if (!input.active || !input.info || input.cacheHit) return warm;
  if (input.info.bootId === input.lastReportedBootId) return warm;
  return {
    boot: { coldStart: true, workerBootMs: input.info.workerBootMs },
    reportedBootId: input.info.bootId,
  };
};

export const workerReplacementCount = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : Math.min(MAX_WORKER_REPLACEMENTS, value);

export const geometryReadyTimingProperties = (
  timings: Record<string, number> | undefined,
  boot: GeometryBootAttribution | undefined,
): AnalyticsProperties => ({
  wasm_wait_ms: roundedMs(timings?.wasmWaitMs),
  worker_compute_ms: roundedMs(timings?.workerComputeMs),
  client_round_trip_ms: roundedMs(timings?.clientRoundTripMs),
  client_queue_ms: roundedMs(timings?.clientQueueMs),
  worker_boot_ms: boot?.coldStart ? roundedMs(boot.workerBootMs) : undefined,
  cache_hit: timings?.clientCacheHit === 1,
  cold_start: boot?.coldStart === true,
});

export const previewRenderedProperties = (
  generationId: number,
  template: string | undefined,
  timings: ViewerTimings,
): AnalyticsProperties => ({
  geometry_generation_id: generationId,
  template,
  mesh_setup_ms: roundedMs(timings.meshSetupMs),
  draw_submit_ms: roundedMs(timings.drawSubmitMs),
  initialization_ms: roundedMs(timings.initializationMs),
  cold_start: true,
});

type ColdPreviewTracker = {
  markCold(generationId: number, template: string | undefined): void;
  rendered(generationId: number, timings: ViewerTimings): AnalyticsProperties | undefined;
};

export const createColdPreviewTracker = (): ColdPreviewTracker => {
  let cold: { generationId: number; template: string | undefined } | undefined;
  return {
    markCold: (generationId, template) => {
      cold = { generationId, template };
    },
    rendered: (generationId, timings) => {
      if (!cold || cold.generationId !== generationId) return undefined;
      const properties = previewRenderedProperties(generationId, cold.template, timings);
      cold = undefined;
      return properties;
    },
  };
};
