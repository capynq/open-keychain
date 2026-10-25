// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type WorkerResponse,
} from '@/domain/keychain/model/types';

import { useGeometryGeneration } from './useGeometryGeneration';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    MockWorker.instances.push(this);
  }
  emit(response: WorkerResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }
}

const geometry = () => ({
  baseMesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
  reliefMesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
  dimensions: {
    widthMm: 1,
    heightMm: 1,
    thicknessMm: 1,
    centerMm: [0, 0, 0] as [number, number, number],
  },
  issues: [],
  printable: true,
  appearance: DEFAULT_PRINT_APPEARANCE,
});

const host = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;
let current: ReturnType<typeof useGeometryGeneration>;
const mount = () => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  root = createRoot(host);
  const Harness = () => {
    current = useGeometryGeneration(DEFAULT_PARAMS);
    return null;
  };

  act(() => root!.render(createElement(Harness)));
};

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockWorker.instances = [];
});

it('does not turn a superseded preview into a user-facing failure', async () => {
  mount();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  const next = current.clientRef.current!.request({ ...DEFAULT_PARAMS, text: 'NEW' });

  await act(async () => {
    await Promise.resolve();
  });
  expect(current.error).toBeUndefined();
  expect(current.failure).toBeUndefined();
  await act(async () => {
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 1, result: geometry() });
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 2, result: geometry() });
    await next;
  });
});

it('reports a preview attempt only when dispatched and finishes it with the generation ID', async () => {
  const started = vi.fn();
  const finished = vi.fn();
  const callbacks = { started, finished };

  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  root = createRoot(host);
  const Harness = () => {
    current = useGeometryGeneration(DEFAULT_PARAMS, undefined, undefined, undefined, callbacks);
    return null;
  };

  act(() => root!.render(createElement(Harness)));
  expect(started).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  expect(started).toHaveBeenCalledTimes(1);
  expect(started).toHaveBeenCalledWith(expect.any(String), DEFAULT_PARAMS);
  await act(async () => {
    MockWorker.instances[0].emit({
      type: 'geometry',
      requestId: 1,
      result: geometry(),
    });
  });
  expect(finished).toHaveBeenCalledTimes(1);
  expect(finished).toHaveBeenCalledWith(expect.any(String), 'success', { generationId: 1 });
});

it('retries a failed worker operation with the current design', async () => {
  mount();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
  });
  expect(current.failure?.code).toBe('geometry-worker-failed');
  act(() => current.retry());
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  expect(MockWorker.instances[1].postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'generate', params: DEFAULT_PARAMS }),
  );
  await act(async () => {
    MockWorker.instances[1].emit({ type: 'geometry', requestId: 2, result: geometry() });
  });
  expect(current.error).toBeUndefined();
  expect(current.current).toBe(true);
});

it('re-arms exhausted worker recovery only when preview retry is explicit', async () => {
  mount();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
    MockWorker.instances[1].onerror?.();
  });
  expect(MockWorker.instances).toHaveLength(2);
  act(() => current.retry());
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  expect(MockWorker.instances).toHaveLength(3);
  await act(async () => {
    MockWorker.instances[2].emit({ type: 'geometry', requestId: 2, result: geometry() });
  });
  expect(current.error).toBeUndefined();
  expect(current.current).toBe(true);
});
