// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  clients: [] as { dispose: () => void; isUsable: () => boolean }[],
  constructFailures: 0,
  imports: 0,
  importFailures: 0,
}));

const mockGeometryClient = () => {
  vi.doMock('../../infrastructure/geometry/geometry-client', () => {
    state.imports += 1;
    if (state.importFailures > 0) {
      state.importFailures -= 1;
      throw new Error('geometry chunk failed to load');
    }

    class GeometryClient {
      dispose = vi.fn();
      isUsable = () => true;

      constructor() {
        if (state.constructFailures > 0) {
          state.constructFailures -= 1;
          throw new Error('Worker blocked by CSP');
        }
        state.clients.push(this);
      }
    }

    return { GeometryClient };
  });
};

let loadAndPrewarm: (shouldPrewarm?: () => boolean) => void;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const unhandled = vi.fn();

beforeEach(async () => {
  unhandled.mockClear();
  process.on('unhandledRejection', unhandled);
  vi.stubGlobal('Worker', class {});
  vi.resetModules();
  mockGeometryClient();
  state.clients = [];
  state.constructFailures = 0;
  state.imports = 0;
  state.importFailures = 0;
  ({ loadAndPrewarm } = await import('./geometryPrewarm'));
});

afterEach(() => {
  process.off('unhandledRejection', unhandled);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('imports the pool once and prewarms once for repeated calls', async () => {
  loadAndPrewarm();
  loadAndPrewarm();

  await vi.waitFor(() => expect(state.clients).toHaveLength(1));
  expect(state.imports).toBe(1);
});

it('retries the import after a rejection without an unhandled rejection', async () => {
  state.importFailures = 1;

  loadAndPrewarm();
  await flush();
  expect(state.clients).toHaveLength(0);
  expect(unhandled).not.toHaveBeenCalled();

  vi.resetModules();
  mockGeometryClient();
  loadAndPrewarm();
  await vi.waitFor(() => expect(state.clients).toHaveLength(1));
  expect(state.imports).toBe(2);
  expect(unhandled).not.toHaveBeenCalled();
});

it('does not leak a throw from the prewarm into an unhandled rejection', async () => {
  state.constructFailures = 1;

  loadAndPrewarm();
  await flush();
  expect(unhandled).not.toHaveBeenCalled();
  expect(state.clients).toHaveLength(0);

  loadAndPrewarm();
  await vi.waitFor(() => expect(state.clients).toHaveLength(1));
});

it('skips the prewarm when the guard fails after the import resolves', async () => {
  loadAndPrewarm(() => false);

  await flush();
  expect(state.imports).toBe(1);
  expect(state.clients).toHaveLength(0);
});

it('prewarms again through the helper after the TTL disposes an untaken client', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  loadAndPrewarm();
  await vi.waitFor(() => expect(state.clients).toHaveLength(1));

  vi.advanceTimersByTime(5 * 60_000);
  expect(state.clients[0]!.dispose).toHaveBeenCalledTimes(1);

  loadAndPrewarm();
  await vi.waitFor(() => expect(state.clients).toHaveLength(2));
});
