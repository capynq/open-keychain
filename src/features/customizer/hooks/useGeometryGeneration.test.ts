// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type KeychainParams,
  type WorkerResponse,
} from '@/domain/keychain/model/types';
import {
  prewarmGeometryClient,
  takePrewarmedGeometryClient,
} from '@/infrastructure/geometry/geometry-client-pool';

import { useGeometryGeneration, type GeometryAttemptCallbacks } from './useGeometryGeneration';

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
    current = useGeometryGeneration(DEFAULT_PARAMS, undefined, undefined, undefined, undefined);
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
  expect(started).toHaveBeenCalledWith(expect.any(String), DEFAULT_PARAMS, undefined);
  await act(async () => {
    MockWorker.instances[0].emit({
      type: 'geometry',
      requestId: 1,
      result: geometry(),
    });
  });
  expect(finished).toHaveBeenCalledTimes(1);
  expect(finished).toHaveBeenCalledWith(
    expect.any(String),
    'success',
    expect.objectContaining({ generationId: 1, boot: { coldStart: true } }),
  );
});

const mountWithCallbacks = (callbacks: GeometryAttemptCallbacks) => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  root = createRoot(host);
  const Harness = ({ value }: { value: KeychainParams }) => {
    current = useGeometryGeneration(value, undefined, undefined, undefined, callbacks);
    return null;
  };

  act(() => root!.render(createElement(Harness, { value: DEFAULT_PARAMS })));
  return (next: KeychainParams) => act(() => root!.render(createElement(Harness, { value: next })));
};

it('marks the first adopted result after a boot cold and the next one warm', async () => {
  const callbacks = { started: vi.fn(), finished: vi.fn() };
  const setParams = mountWithCallbacks(callbacks);

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  MockWorker.instances[0].emit({ type: 'ready', requestId: 0 });
  await act(async () => {
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 1, result: geometry() });
  });
  expect(callbacks.finished).toHaveBeenLastCalledWith(
    expect.any(String),
    'success',
    expect.objectContaining({
      generationId: 1,
      boot: { coldStart: true, workerBootMs: expect.any(Number) },
    }),
  );

  setParams({ ...DEFAULT_PARAMS, text: 'NEXT' });
  await act(async () => {
    vi.advanceTimersByTime(90);
  });
  await act(async () => {
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 2, result: geometry() });
  });
  expect(callbacks.finished).toHaveBeenLastCalledWith(
    expect.any(String),
    'success',
    expect.objectContaining({ generationId: 2, boot: { coldStart: false } }),
  );
});

it('attributes a result to the boot that dispatched it when a replacement lands first', async () => {
  const callbacks = { started: vi.fn(), finished: vi.fn() };
  const setParams = mountWithCallbacks(callbacks);

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  MockWorker.instances[0].emit({ type: 'ready', requestId: 0 });
  await act(async () => {
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 1, result: geometry() });
    MockWorker.instances[0].onerror?.();
  });
  expect(callbacks.finished).toHaveBeenLastCalledWith(
    expect.any(String),
    'success',
    expect.objectContaining({ boot: { coldStart: true, workerBootMs: expect.any(Number) } }),
  );

  setParams({ ...DEFAULT_PARAMS, text: 'AFTER' });
  await act(async () => {
    vi.advanceTimersByTime(90);
  });
  MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
  await act(async () => {
    MockWorker.instances[1].emit({ type: 'geometry', requestId: 2, result: geometry() });
  });
  expect(callbacks.finished).toHaveBeenLastCalledWith(
    expect.any(String),
    'success',
    expect.objectContaining({ boot: { coldStart: true, workerBootMs: expect.any(Number) } }),
  );
});

it('re-requests the current design once after an automatic worker replacement', async () => {
  const started = vi.fn();
  const setParams = mountWithCallbacks({ started, finished: vi.fn() });

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
  });
  expect(current.failure).toBeUndefined();
  expect(MockWorker.instances).toHaveLength(2);
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  expect(MockWorker.instances[1].postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'generate', params: DEFAULT_PARAMS }),
  );
  expect(started).toHaveBeenLastCalledWith(expect.any(String), DEFAULT_PARAMS, 'auto_replacement');
  await act(async () => {
    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    MockWorker.instances[1].emit({ type: 'geometry', requestId: 2, result: geometry() });
  });
  expect(current.error).toBeUndefined();
  expect(current.current).toBe(true);
  setParams(DEFAULT_PARAMS);
});

it('does not re-request the current design after a request timeout', async () => {
  const started = vi.fn();
  const setParams = mountWithCallbacks({ started, finished: vi.fn() });

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].emit({ type: 'ready', requestId: 0 });
  });
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  expect(started).not.toHaveBeenLastCalledWith(
    expect.any(String),
    DEFAULT_PARAMS,
    'auto_replacement',
  );
  expect(current.failure?.code).toBe('geometry-request-timeout');
  setParams(DEFAULT_PARAMS);
});

it('does not re-request a build failure returned by the replacement', async () => {
  mount();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
  });
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[1].emit({ type: 'error', requestId: 2, message: 'build failed' });
  });
  expect(MockWorker.instances).toHaveLength(2);
  expect(current.failure).toBeDefined();
  expect(MockWorker.instances[1].postMessage).toHaveBeenCalledTimes(2);
});

it('does not re-request after a user edit that arrives before the failure is handled', async () => {
  const started = vi.fn();
  const setParams = mountWithCallbacks({ started, finished: vi.fn() });

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  const edited = { ...DEFAULT_PARAMS, text: 'EDITED' };

  act(() => {
    MockWorker.instances[0].onerror?.();
    setParams(edited);
  });
  await act(async () => {
    vi.advanceTimersByTime(90);
  });
  expect(MockWorker.instances).toHaveLength(2);
  expect(MockWorker.instances[1].postMessage.mock.calls.map(([message]) => message)).toEqual([
    { type: 'warmup' },
    expect.objectContaining({ type: 'generate', params: edited }),
  ]);
  expect(started).not.toHaveBeenLastCalledWith(
    expect.any(String),
    DEFAULT_PARAMS,
    'auto_replacement',
  );
});

it('stops auto re-requests once the replacement budget is exhausted', async () => {
  mount();
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
  });
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[1].onerror?.();
  });
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(MockWorker.instances).toHaveLength(3);
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[2].onerror?.();
  });
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  expect(MockWorker.instances).toHaveLength(3);
  expect(current.failure?.code).toBe('geometry-worker-failed');
  expect(
    MockWorker.instances[2].postMessage.mock.calls.filter(([m]) => m.type === 'generate'),
  ).toHaveLength(1);
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

it('does not label a user edit made during the re-request window as an automatic replacement', async () => {
  const started = vi.fn();
  const setParams = mountWithCallbacks({ started, finished: vi.fn() });

  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  await act(async () => {
    MockWorker.instances[0].onerror?.();
  });
  const edited = { ...DEFAULT_PARAMS, text: 'EDITED' };

  setParams(edited);
  await act(async () => {
    vi.advanceTimersByTime(90);
  });
  expect(started).toHaveBeenLastCalledWith(expect.any(String), edited, undefined);
});

it('adopts a prewarmed client without starting a second worker and disposes it on unmount', () => {
  vi.stubGlobal('Worker', MockWorker);
  prewarmGeometryClient();

  const prewarmed = MockWorker.instances[0];

  mount();

  expect(MockWorker.instances).toHaveLength(1);
  expect(current.clientRef.current?.bootInfo()?.bootId).toBe(1);
  act(() => root?.unmount());
  root = undefined;
  expect(prewarmed.terminate).toHaveBeenCalledTimes(1);
  expect(takePrewarmedGeometryClient()).toBeUndefined();
});

it('sends the first preview to a prewarmed client that is already ready', async () => {
  vi.stubGlobal('Worker', MockWorker);
  prewarmGeometryClient();

  const prewarmed = MockWorker.instances[0];

  prewarmed.emit({ type: 'ready' } as WorkerResponse);
  mount();

  await act(async () => {
    vi.advanceTimersByTime(0);
  });

  expect(prewarmed.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'generate' }));
  expect(current.clientRef.current?.bootInfo()?.workerBootMs).toEqual(expect.any(Number));
});

const mountWithAttempts = (attemptCallbacks: GeometryAttemptCallbacks) => {
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  root = createRoot(host);
  const Harness = () => {
    current = useGeometryGeneration(
      DEFAULT_PARAMS,
      undefined,
      undefined,
      undefined,
      attemptCallbacks,
    );
    return null;
  };

  act(() => root!.render(createElement(Harness)));
};

const finishFirstPreview = async (worker: MockWorker) => {
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
  const generate = worker.postMessage.mock.calls
    .map(([message]) => message as { type: string; requestId: number })
    .find((message) => message.type === 'generate');

  await act(async () => {
    worker.emit({
      type: 'geometry',
      requestId: generate!.requestId,
      result: geometry(),
    } as WorkerResponse);
    await Promise.resolve();
  });
};

it('reports the worker boot time when the boot finished after the hook took a pooled client', async () => {
  vi.stubGlobal('Worker', MockWorker);
  prewarmGeometryClient();
  const worker = MockWorker.instances[0];
  const finished = vi.fn();

  mountWithAttempts({ started: vi.fn(), finished });

  worker.emit({ type: 'ready' } as WorkerResponse);
  await finishFirstPreview(worker);

  const details = finished.mock.calls[0]?.[2];

  expect(finished.mock.calls[0]?.[1]).toBe('success');
  expect(details?.boot).toEqual({ coldStart: true, workerBootMs: expect.any(Number) });
});

it('reports cold start without a worker boot time when the boot finished while pooled', async () => {
  vi.stubGlobal('Worker', MockWorker);
  prewarmGeometryClient();
  const worker = MockWorker.instances[0];

  worker.emit({ type: 'ready' } as WorkerResponse);
  const finished = vi.fn();

  mountWithAttempts({ started: vi.fn(), finished });

  await finishFirstPreview(worker);

  const details = finished.mock.calls[0]?.[2];

  expect(finished.mock.calls[0]?.[1]).toBe('success');
  expect(details?.boot?.coldStart).toBe(true);
  expect(details?.boot?.workerBootMs).toBeUndefined();
});
