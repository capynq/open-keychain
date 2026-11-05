// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLandingIdlePrewarm } from './useLandingIdlePrewarm';

const { prewarmGeometryClient } = vi.hoisted(() => ({ prewarmGeometryClient: vi.fn() }));

vi.mock('../../infrastructure/geometry/geometry-client-pool', () => ({ prewarmGeometryClient }));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;
let readyState: DocumentReadyState = 'loading';
let idleCallbacks = new Map<number, () => void>();
let nextIdleId = 1;
const requestIdleCallback = vi.fn((callback: () => void) => {
  const id = nextIdleId++;

  idleCallbacks.set(id, callback);
  return id;
});
const cancelIdleCallback = vi.fn((id: number) => idleCallbacks.delete(id));

const Harness = ({ pathname }: { pathname: string }) => {
  useLandingIdlePrewarm(pathname);
  return null;
};

const render = (pathname: string) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root ??= createRoot(host);
  act(() => root!.render(createElement(Harness, { pathname })));
};

const fireLoad = () => act(() => window.dispatchEvent(new Event('load')));

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

const runIdle = () => {
  const callbacks = [...idleCallbacks.values()];

  idleCallbacks = new Map();
  act(() => callbacks.forEach((callback) => callback()));
};

const setConnection = (connection: Record<string, unknown> | undefined) => {
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
};

beforeEach(() => {
  readyState = 'loading';
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => readyState });
  vi.stubGlobal('requestIdleCallback', requestIdleCallback);
  vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  idleCallbacks = new Map();
  prewarmGeometryClient.mockClear();
  requestIdleCallback.mockClear();
  cancelIdleCallback.mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setConnection(undefined);
  Reflect.deleteProperty(document, 'readyState');
  window.history.replaceState({}, '', '/');
});

it('waits for window load and then for idle before prewarming', async () => {
  render('/');

  expect(requestIdleCallback).not.toHaveBeenCalled();
  fireLoad();

  expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 4000 });
  expect(prewarmGeometryClient).not.toHaveBeenCalled();

  runIdle();
  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
});

it('does not prewarm before the load event', async () => {
  render('/');
  await macrotask();

  expect(requestIdleCallback).not.toHaveBeenCalled();
  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it('schedules immediately when the document has already loaded', async () => {
  readyState = 'complete';
  render('/');

  expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  runIdle();
  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
});

it('falls back to a 1500 ms timer where requestIdleCallback is unavailable', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestIdleCallback', undefined);
  readyState = 'complete';
  render('/');

  vi.advanceTimersByTime(1499);
  expect(prewarmGeometryClient).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
});

it('skips the prewarm when data saver is enabled', async () => {
  setConnection({ saveData: true, effectiveType: '4g' });
  readyState = 'complete';
  render('/');

  runIdle();
  await macrotask();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it.each(['slow-2g', '2g'])('skips the prewarm on %s connections', async (effectiveType) => {
  setConnection({ saveData: false, effectiveType });
  readyState = 'complete';
  render('/');

  runIdle();
  await macrotask();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it('cancels the scheduled prewarm when leaving the landing route', async () => {
  render('/');
  fireLoad();

  render('/create');
  expect(cancelIdleCallback).toHaveBeenCalledTimes(1);

  runIdle();
  await macrotask();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it('removes the load listener when unmounted before load', async () => {
  render('/');
  act(() => root?.unmount());
  root = undefined;

  fireLoad();
  await macrotask();

  expect(requestIdleCallback).not.toHaveBeenCalled();
  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it.each(['/privacy', '/create', '/profile'])('is not scheduled on %s', async (pathname) => {
  readyState = 'complete';
  render(pathname);
  fireLoad();

  expect(requestIdleCallback).not.toHaveBeenCalled();
  await macrotask();
  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it('treats localized home paths as the landing route', async () => {
  readyState = 'complete';
  window.history.replaceState({}, '', '/ru/');
  render('/ru/');

  expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  runIdle();
  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
});

it('does not prewarm when the route changes to /create before the import resolves', async () => {
  readyState = 'complete';
  render('/');

  runIdle();
  window.history.replaceState({}, '', '/create');
  await macrotask();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

describe('landing LCP gate', () => {
  let lcpListener: (() => void) | undefined;
  let observed = 0;

  class FakePerformanceObserver {
    static supportedEntryTypes = ['largest-contentful-paint'];
    disconnect = vi.fn();
    observe = () => {
      observed += 1;
    };

    constructor(callback: () => void) {
      lcpListener = callback;
    }
  }

  beforeEach(() => {
    lcpListener = undefined;
    observed = 0;
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    readyState = 'complete';
  });

  it('schedules idle only after LCP has been quiet for 1 s', () => {
    render('/');
    expect(observed).toBe(1);

    lcpListener!();
    vi.advanceTimersByTime(500);
    lcpListener!();
    vi.advanceTimersByTime(999);
    expect(requestIdleCallback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it('cancels the LCP wait when leaving the landing route', () => {
    render('/');
    lcpListener!();

    render('/create');
    vi.advanceTimersByTime(5_000);

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(prewarmGeometryClient).not.toHaveBeenCalled();
  });
});
