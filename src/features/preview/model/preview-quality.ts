export type PreviewQualityTier = 'high' | 'medium' | 'low';

export const PREVIEW_QUALITY_TIERS: readonly PreviewQualityTier[] = ['high', 'medium', 'low'];

export const PREVIEW_SLOW_BUILD_MS = 2500;
export const PREVIEW_FAST_BUILD_MS = 1000;
export const PREVIEW_SLOW_RESULTS_TO_STEP_DOWN = 2;
export const PREVIEW_FAST_RESULTS_TO_STEP_UP = 5;
export const PREVIEW_STEP_UP_COOLDOWN_MS = 30_000;

export type PreviewQualitySample = {
  workerComputeMs?: number;
  bootId?: number;
  cacheHit: boolean;
};

export type PreviewQualityController = {
  readonly tier: PreviewQualityTier;
  observe(sample: PreviewQualitySample): PreviewQualityTier;
};

const PIXEL_RATIO_CAP: Record<PreviewQualityTier, number> = { high: 2, medium: 1.5, low: 1 };

/* Only worker-built results stamped with a boot identity can be classified as warm or cold. */
export const previewQualitySample = (
  timings: Record<string, number> | undefined,
): PreviewQualitySample | undefined =>
  timings?.bootId === undefined
    ? undefined
    : {
        bootId: timings.bootId,
        workerComputeMs: timings.workerComputeMs,
        cacheHit: timings.clientCacheHit === 1 || timings.workerCacheHit === 1,
      };

const tierBelow = (tier: PreviewQualityTier): PreviewQualityTier =>
  PREVIEW_QUALITY_TIERS[
    Math.min(PREVIEW_QUALITY_TIERS.length - 1, PREVIEW_QUALITY_TIERS.indexOf(tier) + 1)
  ];

const tierAbove = (tier: PreviewQualityTier): PreviewQualityTier =>
  PREVIEW_QUALITY_TIERS[Math.max(0, PREVIEW_QUALITY_TIERS.indexOf(tier) - 1)];

export const previewRendererSettings = (
  tier: PreviewQualityTier,
  environment: { devicePixelRatio: number; viewportWidth: number },
): { pixelRatio: number; shadowMapSize: number } => ({
  pixelRatio: Math.min(environment.devicePixelRatio, PIXEL_RATIO_CAP[tier]),
  shadowMapSize:
    tier === 'low' ? 512 : tier === 'medium' ? 1024 : environment.viewportWidth < 760 ? 1024 : 2048,
});

export const createPreviewQualityController = (
  options: { tier?: PreviewQualityTier; now?: () => number } = {},
): PreviewQualityController => {
  const now = options.now ?? (() => performance.now());
  let tier: PreviewQualityTier = options.tier ?? 'high';
  let lastBootId: number | undefined;
  let slowStreak = 0;
  let fastStreak = 0;
  let lastTierChangeAt: number | undefined;

  const setTier = (next: PreviewQualityTier): void => {
    tier = next;
    slowStreak = 0;
    fastStreak = 0;
    lastTierChangeAt = now();
  };

  return {
    get tier() {
      return tier;
    },
    observe(sample) {
      if (sample.cacheHit) return tier;
      if (sample.bootId !== undefined) {
        const coldBoot = sample.bootId !== lastBootId;
        lastBootId = sample.bootId;
        if (coldBoot) return tier;
      }
      const ms = sample.workerComputeMs;
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return tier;

      if (ms > PREVIEW_SLOW_BUILD_MS) {
        slowStreak += 1;
        fastStreak = 0;
        if (slowStreak >= PREVIEW_SLOW_RESULTS_TO_STEP_DOWN && tier !== 'low')
          setTier(tierBelow(tier));
      } else if (ms < PREVIEW_FAST_BUILD_MS) {
        fastStreak += 1;
        slowStreak = 0;
        const cooledDown =
          lastTierChangeAt === undefined || now() - lastTierChangeAt >= PREVIEW_STEP_UP_COOLDOWN_MS;
        if (fastStreak >= PREVIEW_FAST_RESULTS_TO_STEP_UP && tier !== 'high' && cooledDown)
          setTier(tierAbove(tier));
      } else {
        slowStreak = 0;
        fastStreak = 0;
      }
      return tier;
    },
  };
};
