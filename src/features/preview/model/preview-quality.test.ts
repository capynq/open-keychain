import { describe, expect, it } from 'vitest';

import {
  createPreviewQualityController,
  previewQualitySample,
  previewRendererSettings,
  type PreviewQualityController,
} from './preview-quality';

const slow = { workerComputeMs: 2600, bootId: 1, cacheHit: false };
const fast = { workerComputeMs: 400, bootId: 1, cacheHit: false };
const middle = { workerComputeMs: 1800, bootId: 1, cacheHit: false };

const setup = (tier?: 'high' | 'medium' | 'low') => {
  let now = 0;
  const controller: PreviewQualityController = createPreviewQualityController({
    tier,
    now: () => now,
  });
  controller.observe({ workerComputeMs: 3000, bootId: 1, cacheHit: false });
  return {
    controller,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

describe('preview quality controller', () => {
  it('steps down only after two consecutive slow adopted builds', () => {
    const { controller } = setup();
    controller.observe(slow);
    expect(controller.tier).toBe('high');
    controller.observe(slow);
    expect(controller.tier).toBe('medium');
  });

  it('steps down again only after two more slow builds and stops at low', () => {
    const { controller } = setup();
    for (let i = 0; i < 4; i += 1) controller.observe(slow);
    expect(controller.tier).toBe('low');
    for (let i = 0; i < 4; i += 1) controller.observe(slow);
    expect(controller.tier).toBe('low');
  });

  it('does not step up before five fast builds or before the cooldown', () => {
    const { controller, advance } = setup('low');
    for (let i = 0; i < 4; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('low');
    controller.observe(fast);
    expect(controller.tier).toBe('medium');

    advance(29_999);
    for (let i = 0; i < 5; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('medium');
    advance(1);
    controller.observe(fast);
    expect(controller.tier).toBe('high');
  });

  it('never flaps when slow and fast results alternate or a mid-range build breaks a streak', () => {
    const { controller, advance } = setup('medium');
    for (let i = 0; i < 10; i += 1) controller.observe(i % 2 === 0 ? slow : fast);
    expect(controller.tier).toBe('medium');

    controller.observe(middle);
    advance(60_000);
    for (let i = 0; i < 4; i += 1) controller.observe(fast);
    controller.observe(middle);
    controller.observe(fast);
    expect(controller.tier).toBe('medium');

    controller.observe(slow);
    controller.observe(middle);
    controller.observe(slow);
    expect(controller.tier).toBe('medium');
  });

  it('ignores cache hits and the first result of each worker boot without breaking streaks', () => {
    const { controller } = setup();
    controller.observe(slow);
    controller.observe({ ...slow, cacheHit: true });
    expect(controller.tier).toBe('high');
    controller.observe(slow);
    expect(controller.tier).toBe('medium');

    const rebooted = setup();
    rebooted.controller.observe(slow);
    rebooted.controller.observe({ ...slow, bootId: 2 });
    expect(rebooted.controller.tier).toBe('high');
    rebooted.controller.observe({ ...slow, bootId: 2 });
    expect(rebooted.controller.tier).toBe('medium');
  });

  it('ignores samples without a finite build time', () => {
    const { controller } = setup();
    controller.observe({ bootId: 1, cacheHit: false });
    controller.observe({ bootId: 1, cacheHit: false, workerComputeMs: Number.NaN });
    controller.observe({ ...slow, workerComputeMs: undefined });
    expect(controller.tier).toBe('high');
  });

  it('never raises above high', () => {
    const { controller, advance } = setup('high');
    advance(60_000);
    for (let i = 0; i < 10; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('high');
  });
});

describe('preview renderer settings', () => {
  const desktop = { devicePixelRatio: 2, viewportWidth: 1280 };

  it('keeps high tier identical to the previous renderer settings', () => {
    expect(previewRendererSettings('high', desktop)).toEqual({
      pixelRatio: 2,
      shadowMapSize: 2048,
    });
    expect(previewRendererSettings('high', { devicePixelRatio: 3, viewportWidth: 390 })).toEqual({
      pixelRatio: 2,
      shadowMapSize: 1024,
    });
  });

  it('caps medium at 1.5 pixel ratio and 1024 shadows regardless of viewport', () => {
    expect(previewRendererSettings('medium', desktop)).toEqual({
      pixelRatio: 1.5,
      shadowMapSize: 1024,
    });
    expect(previewRendererSettings('medium', { devicePixelRatio: 1, viewportWidth: 390 })).toEqual({
      pixelRatio: 1,
      shadowMapSize: 1024,
    });
  });

  it('uses pixel ratio 1 and 512 shadows at low tier', () => {
    expect(previewRendererSettings('low', { devicePixelRatio: 3, viewportWidth: 1280 })).toEqual({
      pixelRatio: 1,
      shadowMapSize: 512,
    });
  });
});

describe('preview quality samples', () => {
  it('observes only worker-built results stamped with a boot identity', () => {
    expect(previewQualitySample(undefined)).toBeUndefined();
    expect(previewQualitySample({ workerComputeMs: 900 })).toBeUndefined();
    expect(previewQualitySample({ bootId: 2, workerComputeMs: 900 })).toEqual({
      bootId: 2,
      workerComputeMs: 900,
      cacheHit: false,
    });
    expect(
      previewQualitySample({ bootId: 2, workerComputeMs: 0, workerCacheHit: 1 }),
    ).toMatchObject({ cacheHit: true });
    expect(
      previewQualitySample({ bootId: 2, workerComputeMs: 0, clientCacheHit: 1 }),
    ).toMatchObject({ cacheHit: true });
  });
});

describe('preview quality cooldown', () => {
  it('steps down promptly after a step-up even inside the cooldown window', () => {
    const { controller, advance } = setup('low');
    for (let i = 0; i < 5; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('medium');
    advance(5_000);
    controller.observe(slow);
    controller.observe(slow);
    expect(controller.tier).toBe('low');
  });

  it('does not step up immediately after a step-down, waiting for the cooldown from that change', () => {
    const { controller, advance } = setup('high');
    controller.observe(slow);
    controller.observe(slow);
    expect(controller.tier).toBe('medium');
    for (let i = 0; i < 5; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('medium');

    advance(29_999);
    controller.observe(fast);
    expect(controller.tier).toBe('medium');
    advance(1);
    controller.observe(fast);
    expect(controller.tier).toBe('high');
  });

  it('keeps a fast streak across the cooldown and steps up at the first fast build after it', () => {
    const { controller, advance } = setup('low');
    for (let i = 0; i < 5; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('medium');
    advance(10_000);
    for (let i = 0; i < 5; i += 1) controller.observe(fast);
    expect(controller.tier).toBe('medium');
    advance(20_000);
    controller.observe(fast);
    expect(controller.tier).toBe('high');
  });
});
