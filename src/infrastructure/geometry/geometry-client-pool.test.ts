// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { GeometryClient } from './geometry-client';
import {
  PREWARM_TTL_MS,
  prewarmGeometryClient,
  takePrewarmedGeometryClient,
} from './geometry-client-pool';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: unknown = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    MockWorker.instances.push(this);
  }
  emitReady() {
    (this.onmessage as ((event: MessageEvent) => void) | null)?.(
      new MessageEvent('message', { data: { type: 'ready' } }),
    );
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', MockWorker);
});

afterEach(() => {
  takePrewarmedGeometryClient()?.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockWorker.instances = [];
});

it('creates a single pooled client across repeated prewarms', () => {
  prewarmGeometryClient();
  prewarmGeometryClient();

  expect(MockWorker.instances).toHaveLength(1);
});

it('hands the pooled client over exactly once', () => {
  prewarmGeometryClient();
  const client = takePrewarmedGeometryClient();

  expect(client).toBeDefined();
  expect(takePrewarmedGeometryClient()).toBeUndefined();
  prewarmGeometryClient();
  expect(MockWorker.instances).toHaveLength(2);
});

it('disposes an untaken client after the TTL', () => {
  prewarmGeometryClient();
  MockWorker.instances[0].emitReady();
  vi.advanceTimersByTime(PREWARM_TTL_MS - 1);
  expect(MockWorker.instances[0].terminate).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(MockWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  expect(takePrewarmedGeometryClient()).toBeUndefined();
});

it('does not dispose a client that was taken before the TTL', () => {
  prewarmGeometryClient();
  MockWorker.instances[0].emitReady();
  const client = takePrewarmedGeometryClient();
  vi.advanceTimersByTime(PREWARM_TTL_MS);

  expect(client).toBeDefined();
  expect(MockWorker.instances[0].terminate).not.toHaveBeenCalled();
});

it('does nothing without a Worker constructor', () => {
  vi.stubGlobal('Worker', undefined);
  prewarmGeometryClient();

  expect(MockWorker.instances).toHaveLength(0);
  expect(takePrewarmedGeometryClient()).toBeUndefined();
});

it('discards a pooled client whose boot failed with the replacement budget exhausted', () => {
  const dispose = vi.spyOn(GeometryClient.prototype, 'dispose');
  prewarmGeometryClient();
  const fail = (index: number) => (MockWorker.instances[index].onerror as () => void)();
  fail(0);
  fail(1);
  vi.advanceTimersByTime(1_000);
  fail(2);

  expect(takePrewarmedGeometryClient()).toBeUndefined();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(takePrewarmedGeometryClient()).toBeUndefined();
  dispose.mockRestore();
});

it('creates a fresh client when prewarmed again after the TTL fired', () => {
  prewarmGeometryClient();
  MockWorker.instances[0].emitReady();
  vi.advanceTimersByTime(PREWARM_TTL_MS);
  prewarmGeometryClient();

  expect(MockWorker.instances).toHaveLength(2);
  expect(MockWorker.instances[1].terminate).not.toHaveBeenCalled();
  expect(takePrewarmedGeometryClient()).toBeDefined();
});
