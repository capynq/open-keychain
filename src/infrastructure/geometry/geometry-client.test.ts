import { afterEach, describe, expect, it, vi } from 'vitest';

import { FONT_CATALOG } from '../../domain/keychain/fonts/catalog';
import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type GeometryResult,
  type WorkerResponse,
} from '../../domain/keychain/model/types';
import { RecoveryError } from '../../shared/lib/recovery/failure';
import {
  assertAcceptableResult,
  GeometryCandidateSupersededError,
  GeometryClient,
} from './geometry-client';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  emit(response: WorkerResponse): void {
    this.onmessage?.(new MessageEvent<WorkerResponse>('message', { data: response }));
  }

  constructor() {
    MockWorker.instances.push(this);
  }
}

const result = () => ({
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
  parts: [
    {
      id: 'base',
      name: 'Base',
      role: 'base' as const,
      mesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
    },
  ],
});

afterEach(() => {
  vi.useRealTimers();
  MockWorker.instances.length = 0;
  vi.unstubAllGlobals();
});

describe('GeometryClient lifecycle', () => {
  it('allows one new-edit recovery after automatic recovery is exhausted', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    MockWorker.instances[1].onmessageerror?.();

    expect(MockWorker.instances).toHaveLength(2);
    expect(() => client.recoverForUserEdit()).not.toThrow();
    expect(MockWorker.instances).toHaveLength(3);
    const pending = client.validateCandidate(DEFAULT_PARAMS);
    MockWorker.instances[2].onerror?.();
    expect(() => client.recoverForUserEdit()).toThrow('Geometry worker failed.');
    await expect(pending).rejects.toMatchObject({ failure: { code: 'geometry-worker-failed' } });
    client.dispose();
  });

  it('keeps worker-construction failures retryable with initialization diagnostics', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('Worker construction blocked');
        }
      },
    );
    const client = new GeometryClient();
    await expect(client.validateCandidate(DEFAULT_PARAMS)).rejects.toMatchObject({
      diagnostics: { stage: 'initialization', type: 'worker_unavailable' },
      failure: { code: 'geometry-worker-init-failed' },
    });

    vi.stubGlobal('Worker', MockWorker);
    expect(() => client.recoverForUserRetry()).not.toThrow();
    const pending = client.validateCandidate(DEFAULT_PARAMS);
    MockWorker.instances[0].emit({ type: 'validation', requestId: 1, result: result() });
    await expect(pending).resolves.toMatchObject({ printable: true });
    client.dispose();
  });

  it('allocates unique editor generations for verified background results', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const background = { ...result(), generationId: 1 };
    const identified = client.identifyValidatedResult(background);
    const normal = client.request(DEFAULT_PARAMS);
    expect(MockWorker.instances[0].postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: 2 }),
    );
    MockWorker.instances[0].emit({ type: 'geometry', requestId: 2, result: result() });
    expect((await normal).generationId).not.toBe(identified.generationId);
    expect(background.generationId).toBe(1);
    expect(client.identifyValidatedResult(background).generationId).toBe(3);
    client.dispose();
  });

  it('preserves structured worker recovery failures', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const pending = client.validate(DEFAULT_PARAMS);
    worker.emit({
      type: 'error',
      requestId: 1,
      message: 'too large',
      failure: {
        code: 'text-edge-too-large',
        message: 'too large',
        context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.4 },
      },
    });
    await expect(pending).rejects.toBeInstanceOf(RecoveryError);
    await expect(pending).rejects.toMatchObject({
      failure: { code: 'text-edge-too-large', context: { maximumMm: 0.2, requestedMm: 0.4 } },
    });
    client.dispose();
  });

  it('coalesces candidates to one active request and one latest queued request', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const first = client.validateCandidate(DEFAULT_PARAMS);
    const second = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'SECOND' });
    const third = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'THIRD' });
    await expect(first).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    await expect(second).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'validate', requestId: 1 }),
    );
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'validate', requestId: 3 }),
    );
    worker.emit({ type: 'validation', requestId: 3, result: result() });
    await expect(third).resolves.toMatchObject({ generationId: 3 });
    client.dispose();
  });

  it('dispatches the latest candidate after an obsolete active candidate errors', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const active = client.validateCandidate(DEFAULT_PARAMS);
    const latest = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'LATEST' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    worker.emit({ type: 'error', requestId: 1, message: 'candidate rejected' });
    await activeRejected;
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'validate', requestId: 2 }),
    );
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(latest).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('supersedes an active candidate on a client cache hit without extra worker work', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const seed = client.validateCandidate(DEFAULT_PARAMS);
    worker.emit({
      type: 'validation',
      requestId: 1,
      result: { ...result(), timings: { generationMs: 10, workerComputeMs: 8, nameplateMs: 2 } },
    });
    await seed;
    const active = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const cached = client.validateCandidate(DEFAULT_PARAMS);
    await expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const cachedResult = await cached;
    expect(cachedResult.timings?.clientCacheHit).toBe(1);
    expect(cachedResult.timings?.clientCacheLookupMs).toEqual(expect.any(Number));
    expect(cachedResult.timings?.clientCacheCloneMs).toEqual(expect.any(Number));
    expect(cachedResult.timings?.generationMs).toBeUndefined();
    expect(cachedResult.timings?.workerComputeMs).toBeUndefined();
    expect(cachedResult.timings?.nameplateMs).toBeUndefined();
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    client.dispose();
  });

  it('reuses a cache filled while queued and preserves candidate queue timing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const active = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const queued = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const independent = client.validate({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    worker.emit({ type: 'validation', requestId: 3, result: result() });
    await independent;
    vi.advanceTimersByTime(75);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    await activeRejected;
    const queuedResult = await queued;
    expect(queuedResult.generationId).toBe(2);
    expect(queuedResult.timings?.clientCacheHit).toBe(1);
    expect(queuedResult.timings?.clientQueueMs).toBe(75);
    expect(queuedResult.timings?.clientRoundTripMs).toBeGreaterThanOrEqual(
      queuedResult.timings?.clientQueueMs ?? 0,
    );
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    client.dispose();
  });

  it('measures a queued validation from its dispatch behind a busy head', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 30_000 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const head = client.validate({ ...DEFAULT_PARAMS, text: 'HEAD' });
    const waiting = client.validate({ ...DEFAULT_PARAMS, text: 'WAITING' });
    await vi.advanceTimersByTimeAsync(75);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    await head;
    await vi.advanceTimersByTimeAsync(25);
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    const waitingResult = await waiting;
    expect(waitingResult.timings?.clientQueueMs).toBeCloseTo(75, 0);
    expect(waitingResult.timings?.clientRoundTripMs).toBeCloseTo(25, 0);
    client.dispose();
  });

  it('does not start a queued candidate watchdog before dispatch', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const first = client.validateCandidate(DEFAULT_PARAMS);
    const second = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    const firstRejected = expect(first).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const secondRejected = expect(second).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(499);
    expect(MockWorker.instances).toHaveLength(1);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    await firstRejected;
    expect(MockWorker.instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(500);
    await secondRejected;
    expect(MockWorker.instances).toHaveLength(2);
    client.dispose();
  });

  it('releases queued candidates on worker failure and dispose', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const first = client.validateCandidate(DEFAULT_PARAMS);
    const second = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    const firstRejected = expect(first).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const secondRejected = expect(second).rejects.toThrow('worker failed');
    worker.onerror?.();
    await Promise.all([firstRejected, secondRejected]);
    client.dispose();

    const secondClient = new GeometryClient();
    const pending = secondClient.validateCandidate(DEFAULT_PARAMS);
    const pendingRejected = expect(pending).rejects.toThrow('disposed');
    secondClient.dispose();
    await pendingRejected;
  });

  it('keeps independent validation requests concurrent', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const first = client.validate(DEFAULT_PARAMS);
    const second = client.validate({ ...DEFAULT_PARAMS, text: 'SECOND' });
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(first).resolves.toMatchObject({ generationId: 1 });
    await expect(second).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('accepts a finished text edge with a sharp backing from the worker', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const validation = client.validate({
      ...DEFAULT_PARAMS,
      textEdgeFinish: 'round',
      textEdgeMm: 0.2,
    });
    MockWorker.instances[0].emit({
      type: 'validation',
      requestId: 1,
      result: {
        ...result(),
        edgeFinish: {
          style: 'sharp',
          textStyle: 'round',
          topMm: 0,
          bottomMm: 0,
          textMm: 0.2,
          quality: 'verified',
        },
      },
    });
    await expect(validation).resolves.toMatchObject({
      edgeFinish: { textStyle: 'round', textMm: 0.2 },
    });
    client.dispose();
  });
  it('rejects worker results with off-grid text finish limits', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const validation = client.validate(DEFAULT_PARAMS);
    MockWorker.instances[0].emit({
      type: 'validation',
      requestId: 1,
      result: {
        ...result(),
        textFinishLimits: { chamferMaxMm: 0.41, roundMaxMm: 0.8 },
      },
    });
    await expect(validation).rejects.toThrow('invalid validation result');
    client.dispose();
  });
  it('rejects disposed calls without posting a request', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    client.dispose();
    await expect(client.request(DEFAULT_PARAMS)).rejects.toThrow('disposed');
    await expect(client.export(DEFAULT_PARAMS)).rejects.toThrow('disposed');
    await expect(client.validate(DEFAULT_PARAMS)).rejects.toThrow('disposed');
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects pending operations and recovers with a replacement worker after worker failure', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const preview = client.request(DEFAULT_PARAMS);
    const exportPromise = client.export(DEFAULT_PARAMS);
    const validation = client.validate(DEFAULT_PARAMS);
    const rejected = Promise.all([
      expect(preview).rejects.toThrow('worker failed'),
      expect(exportPromise).rejects.toThrow('worker failed'),
      expect(validation).rejects.toThrow('worker failed'),
    ]);
    worker.onerror?.();
    await rejected;
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(MockWorker.instances).toHaveLength(2);
    const replacement = MockWorker.instances[1];
    const recovered = client.request(DEFAULT_PARAMS);
    replacement.emit({ type: 'geometry', requestId: 4, result: result() });
    await expect(recovered).resolves.toMatchObject({ generationId: 4 });
    client.dispose();
  });

  it('recovers after a message deserialization failure and ignores old worker responses', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const pending = client.request(DEFAULT_PARAMS);
    const rejected = expect(pending).rejects.toThrow('worker failed');
    worker.onmessageerror?.();
    await rejected;
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(MockWorker.instances).toHaveLength(2);
    const replacement = MockWorker.instances[1];
    const recovered = client.validate(DEFAULT_PARAMS);
    replacement.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(recovered).resolves.toMatchObject({ generationId: 2 });
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('bounds hung requests, rejects related work, and can use the replacement worker', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const preview = client.request(DEFAULT_PARAMS);
    const exportPromise = client.export(DEFAULT_PARAMS);
    const validation = client.validate(DEFAULT_PARAMS);
    const rejected = Promise.all([
      expect(preview).rejects.toThrow('timed out'),
      expect(exportPromise).rejects.toThrow('timed out'),
      expect(validation).rejects.toThrow('timed out'),
    ]);

    await vi.advanceTimersByTimeAsync(500);
    await rejected;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(MockWorker.instances).toHaveLength(2);
    const replacement = MockWorker.instances[1];
    const recovered = client.validate(DEFAULT_PARAMS);
    replacement.emit({ type: 'validation', requestId: 4, result: result() });
    await expect(recovered).resolves.toMatchObject({ generationId: 4 });
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
    client.dispose();
  });

  it('recovers explicitly after consecutive failures without replaying old work', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const original = MockWorker.instances[0];
    original.onerror?.();
    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    MockWorker.instances[1].onmessageerror?.();
    await vi.advanceTimersByTimeAsync(1000);
    MockWorker.instances[2].onmessageerror?.();
    await expect(client.export(DEFAULT_PARAMS)).rejects.toMatchObject({
      diagnostics: { type: 'message_error' },
    });
    expect(MockWorker.instances).toHaveLength(3);
    client.recoverForUserRetry();
    const replacement = MockWorker.instances[3];
    expect(replacement.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'warmup' });
    for (const [index, format] of (['stl', '3mf', 'stl'] as const).entries()) {
      const pending = client.export(DEFAULT_PARAMS, format);
      const requestId = index + 1;
      original.emit({ type: 'error', requestId, message: 'obsolete error' });
      replacement.emit({
        type: 'export',
        requestId,
        filename: `model.${format}`,
        mimeType: `model/${format}`,
        data: new ArrayBuffer(4),
      });
      await expect(pending).resolves.toMatchObject({ filename: `model.${format}` });
    }
    client.recoverForUserRetry();
    expect(MockWorker.instances).toHaveLength(4);
    client.dispose();
    expect(() => client.recoverForUserRetry()).toThrow('disposed');
  });

  it('settles pending requests on warmup failure and permits a later explicit restart', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const pending = client.export(DEFAULT_PARAMS);
    const rejected = expect(pending).rejects.toMatchObject({
      diagnostics: { stage: 'initialization', type: 'operation_error' },
    });
    const warmupFailure: WorkerResponse = {
      type: 'error',
      requestId: 0,
      message: 'WASM initialization failed',
    };
    MockWorker.instances[0].emit(warmupFailure);
    await rejected;
    MockWorker.instances[1].emit(warmupFailure);
    expect(MockWorker.instances).toHaveLength(2);
    client.recoverForUserRetry();
    const recovered = client.export(DEFAULT_PARAMS, '3mf');
    MockWorker.instances[2].emit({
      type: 'export',
      requestId: 2,
      filename: 'model.3mf',
      mimeType: 'model/3mf',
      data: new ArrayBuffer(4),
    });
    await expect(recovered).resolves.toMatchObject({ filename: 'model.3mf' });
    client.dispose();
  });

  it('settles another failed retry and allows another user-initiated restart', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    MockWorker.instances[1].onerror?.();
    client.recoverForUserRetry();
    const pending = client.export(DEFAULT_PARAMS);
    const rejected = expect(pending).rejects.toMatchObject({
      diagnostics: { type: 'message_error' },
    });
    MockWorker.instances[2].onmessageerror?.();
    await rejected;
    expect(MockWorker.instances).toHaveLength(3);
    client.recoverForUserRetry();
    expect(MockWorker.instances).toHaveLength(4);
    client.dispose();
  });

  it('reuses exact preview results without posting or sharing mesh buffers', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const first = client.request(DEFAULT_PARAMS);
    const payload = result();
    payload.parts[0].mesh = payload.baseMesh;
    worker.emit({ type: 'geometry', requestId: 1, result: payload });
    const firstResult = await first;
    const secondResult = await client.request(DEFAULT_PARAMS);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(secondResult.generationId).toBe(2);
    expect(secondResult.baseMesh.positions).not.toBe(firstResult.baseMesh.positions);
    expect(secondResult.parts?.[0]?.mesh.positions).toBe(secondResult.baseMesh.positions);
  });

  it('posts validation and export requests without quality or segment options', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const validation = client.validateCandidate(DEFAULT_PARAMS);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    expect((await validation).timings?.bootId).toBe(1);
    const exported = client.export(DEFAULT_PARAMS);
    worker.emit({
      type: 'export',
      requestId: 2,
      filename: 'keychain.stl',
      mimeType: 'model/stl',
      data: new ArrayBuffer(0),
    });
    await exported;
    const [validateMessage, exportMessage] = worker.postMessage.mock.calls
      .slice(1)
      .map(([message]) => message as Record<string, unknown>);
    expect(Object.keys(validateMessage).sort()).toEqual([
      'fontDefinition',
      'params',
      'requestId',
      'subtitleFontDefinition',
      'type',
    ]);
    expect(Object.keys(exportMessage).some((key) => /quality|segment/i.test(key))).toBe(false);
  });

  it('strips worker boot identity from recovery-validated results', () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const identified = client.identifyValidatedResult({
      ...result(),
      generationId: 1,
      timings: { bootId: 4, workerComputeMs: 12 },
    });
    expect(identified.timings).toEqual({ workerComputeMs: 12 });
  });

  it('does not reuse cached geometry for changed inline font bytes', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const firstFont = {
      id: 'uploaded',
      name: 'Uploaded',
      file: 'uploaded.ttf',
      data: new Uint8Array([1]).buffer,
      dataRevision: 'same-revision',
      previewFamily: 'Uploaded',
      weight: 400,
      category: 'Rounded' as const,
      scripts: ['latin'] as const,
      supportsArticulated: false,
      source: 'local' as const,
      provider: 'local-file' as const,
      sampleLatin: 'ALEX',
      sampleCyrillic: 'АБВГ',
      minimumCyrillicWeightMm: 0,
    };
    const first = client.request(DEFAULT_PARAMS, firstFont);
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    await first;
    const second = client.request(DEFAULT_PARAMS, {
      ...firstFont,
      data: new Uint8Array([2]).buffer,
    });
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    worker.emit({ type: 'geometry', requestId: 2, result: result() });
    await second;
    const third = client.request(DEFAULT_PARAMS, {
      ...firstFont,
      minimumCyrillicWeightMm: 0.2,
    });
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
    worker.emit({ type: 'geometry', requestId: 3, result: result() });
    await third;
  });
});

describe('GeometryClient boot identity', () => {
  it('increments bootId on re-boot and measures warmup-to-ready for the current worker', () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    expect(client.bootInfo()).toEqual({ bootId: 1, workerBootMs: undefined });

    MockWorker.instances[0].emit({ type: 'ready', requestId: 0 });
    expect(client.bootInfo()?.workerBootMs).toBeGreaterThanOrEqual(0);

    MockWorker.instances[0].onerror?.();
    expect(client.bootInfo()).toEqual({ bootId: 2, workerBootMs: undefined });
    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    expect(client.bootInfo()?.bootId).toBe(2);
    expect(client.bootInfo()?.workerBootMs).toBeGreaterThanOrEqual(0);
    client.dispose();
  });

  it('stamps geometry results with the boot that dispatched them, even after replacement', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });

    const first = client.request(DEFAULT_PARAMS);
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    expect((await first).timings?.bootId).toBe(1);

    const cached = await client.request(DEFAULT_PARAMS);
    expect(cached.timings?.clientCacheHit).toBe(1);
    expect(cached.timings).not.toHaveProperty('bootId');

    const pending = client.request({ ...DEFAULT_PARAMS, text: 'BETA' });
    worker.emit({ type: 'geometry', requestId: 3, result: result() });
    worker.onerror?.();
    expect((await pending).timings?.bootId).toBe(1);
    expect(client.bootInfo(1)?.workerBootMs).toBeGreaterThanOrEqual(0);

    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    const next = client.request({ ...DEFAULT_PARAMS, text: 'GAMMA' });
    MockWorker.instances[1].emit({ type: 'geometry', requestId: 4, result: result() });
    expect((await next).timings?.bootId).toBe(2);
    expect(client.bootInfo(99)).toBeUndefined();
    client.dispose();
  });

  it('leaves exports free of boot stamps and does not change bootId', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const bootId = client.bootInfo()?.bootId;
    const exported = client.export(DEFAULT_PARAMS).catch(() => undefined);
    expect(client.bootInfo()?.bootId).toBe(bootId);
    client.dispose();
    await exported;
  });
});

const fakeClock = ['setTimeout', 'clearTimeout', 'performance'] as const;

describe('GeometryClient boot watchdog and bounded respawn', () => {
  it('does not time out a slow boot and starts request timers only on ready', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 30_000, warmupTimeoutMs: 45_000 });
    const worker = MockWorker.instances[0];
    const pending = client.request(DEFAULT_PARAMS);
    await vi.advanceTimersByTimeAsync(40_000);
    worker.emit({ type: 'ready', requestId: 0 });
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    await expect(pending).resolves.toMatchObject({ generationId: 1 });
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(MockWorker.instances).toHaveLength(1);
    client.dispose();
  });

  it('respawns after a warmup watchdog failure and serves work queued after it', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ warmupTimeoutMs: 45_000 });
    const hung = client.request(DEFAULT_PARAMS);
    const hungRejected = expect(hung).rejects.toMatchObject({
      failure: { code: 'geometry-worker-boot-timeout' },
      diagnostics: { stage: 'initialization', type: 'timeout' },
    });
    await vi.advanceTimersByTimeAsync(45_000);
    await hungRejected;
    expect(MockWorker.instances).toHaveLength(2);
    expect(MockWorker.instances[0].terminate).toHaveBeenCalledTimes(1);

    const queued = client.request({ ...DEFAULT_PARAMS, text: 'AFTER' });
    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    expect(MockWorker.instances[1].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'generate', requestId: 2 }),
    );
    MockWorker.instances[1].emit({ type: 'geometry', requestId: 2, result: result() });
    await expect(queued).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('recovers on the third worker after two boot failures, applying the respawn delays', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ warmupTimeoutMs: 45_000 });
    const queued = client.request(DEFAULT_PARAMS);
    const queuedRejected = expect(queued).rejects.toThrow('did not start');

    await vi.advanceTimersByTimeAsync(45_000);
    await queuedRejected;
    expect(MockWorker.instances).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(45_000);
    expect(MockWorker.instances).toHaveLength(2);
    const held = client.request({ ...DEFAULT_PARAMS, text: 'HELD' });
    await vi.advanceTimersByTimeAsync(999);
    expect(MockWorker.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWorker.instances).toHaveLength(3);
    expect(client.workerReplacements).toBe(2);

    MockWorker.instances[2].emit({ type: 'ready', requestId: 0 });
    MockWorker.instances[2].emit({ type: 'geometry', requestId: 2, result: result() });
    await expect(held).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('exhausts after two replacements in 60 seconds and keeps explicit retry working', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    expect(client.autoRecoveryEpisodeId()).toBe(1);
    MockWorker.instances[1].onerror?.();
    expect(client.autoRecoveryEpisodeId()).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWorker.instances).toHaveLength(3);
    MockWorker.instances[2].onerror?.();
    expect(client.autoRecoveryEpisodeId()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(MockWorker.instances).toHaveLength(3);
    await expect(client.request(DEFAULT_PARAMS)).rejects.toMatchObject({
      failure: { code: 'geometry-worker-failed' },
    });

    expect(client.recoverForUserRetry()).toBe(true);
    expect(MockWorker.instances).toHaveLength(4);
    client.dispose();
  });

  it('refreshes the replacement budget after the 60 second window', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    MockWorker.instances[1].emit({ type: 'ready', requestId: 0 });
    await vi.advanceTimersByTimeAsync(61_000);
    MockWorker.instances[1].onerror?.();
    expect(MockWorker.instances).toHaveLength(3);
    client.dispose();
  });

  it('does not reset the replacement window on a successful response', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    MockWorker.instances[1].onerror?.();
    await vi.advanceTimersByTimeAsync(1000);
    const validation = client.validate(DEFAULT_PARAMS);
    MockWorker.instances[2].emit({ type: 'validation', requestId: 1, result: result() });
    await expect(validation).resolves.toMatchObject({ generationId: 1 });
    MockWorker.instances[2].onerror?.();
    expect(MockWorker.instances).toHaveLength(3);
    expect(client.autoRecoveryEpisodeId()).toBeUndefined();
    client.dispose();
  });

  it('allows no third automatic replacement across fail, success, fail, success, fail within 60 seconds', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    MockWorker.instances[0].onerror?.();
    const first = client.validate(DEFAULT_PARAMS);
    MockWorker.instances[1].emit({ type: 'validation', requestId: 1, result: result() });
    await expect(first).resolves.toMatchObject({ generationId: 1 });
    MockWorker.instances[1].onerror?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWorker.instances).toHaveLength(3);
    const second = client.validate({ ...DEFAULT_PARAMS, text: 'SECOND' });
    MockWorker.instances[2].emit({ type: 'validation', requestId: 2, result: result() });
    await expect(second).resolves.toMatchObject({ generationId: 2 });
    MockWorker.instances[2].onerror?.();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(MockWorker.instances).toHaveLength(3);
    expect(client.autoRecoveryEpisodeId()).toBeUndefined();
    client.dispose();
  });

  it('rejects work in flight at failure but holds work requested during the respawn delay', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const inFlight = client.validate(DEFAULT_PARAMS);
    const inFlightRejected = expect(inFlight).rejects.toThrow('worker failed');
    MockWorker.instances[0].onerror?.();
    await inFlightRejected;
    MockWorker.instances[1].onerror?.();
    expect(MockWorker.instances).toHaveLength(2);

    const held = client.export(DEFAULT_PARAMS, '3mf');
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWorker.instances).toHaveLength(3);
    expect(MockWorker.instances[2].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'export', requestId: 2 }),
    );
    MockWorker.instances[2].emit({
      type: 'export',
      requestId: 2,
      filename: 'model.3mf',
      mimeType: 'model/3mf',
      data: new ArrayBuffer(4),
    });
    await expect(held).resolves.toMatchObject({ filename: 'model.3mf' });
    client.dispose();
  });

  it('times a request from when the worker begins it, not from when it was queued behind busy work', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 30_000 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const preview = client.request(DEFAULT_PARAMS);
    await vi.advanceTimersByTimeAsync(1_000);
    const validation = client.validate({ ...DEFAULT_PARAMS, text: 'VALIDATE' });
    await vi.advanceTimersByTimeAsync(19_000);
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    await expect(preview).resolves.toMatchObject({ generationId: 1 });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(validation).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('starts no request timer for a superseded queued preview', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const active = client.request(DEFAULT_PARAMS);
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const queued = client.request({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    const queuedRejected = expect(queued).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const latest = client.request({ ...DEFAULT_PARAMS, text: 'LATEST' });
    await Promise.all([activeRejected, queuedRejected]);
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    worker.emit({ type: 'geometry', requestId: 3, result: result() });
    await expect(latest).resolves.toMatchObject({ generationId: 3 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(MockWorker.instances).toHaveLength(1);
    client.dispose();
  });
});

describe('GeometryClient request ordering and failure classification', () => {
  it('stays usable after a candidate fails to post', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    worker.postMessage.mockImplementationOnce(() => {
      throw new Error('clone failed');
    });
    const failed = client.validateCandidate(DEFAULT_PARAMS);
    await expect(failed).rejects.toThrow('clone failed');
    const next = client.validateCandidate({ ...DEFAULT_PARAMS, text: 'NEXT' });
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(next).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('treats an error response without a request id as a worker failure', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const pending = client.validate(DEFAULT_PARAMS);
    const rejected = expect(pending).rejects.toThrow('malformed');
    worker.emit({ type: 'error', message: 'malformed' } as unknown as WorkerResponse);
    await rejected;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(MockWorker.instances).toHaveLength(2);
    client.dispose();
  });

  it('settles a request that answers before the head and keeps the head timer', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const head = client.validate(DEFAULT_PARAMS);
    const headRejected = expect(head).rejects.toThrow('timed out');
    const second = client.validate({ ...DEFAULT_PARAMS, text: 'SECOND' });
    worker.emit({ type: 'validation', requestId: 2, result: result() });
    await expect(second).resolves.toMatchObject({ generationId: 2 });
    await vi.advanceTimersByTimeAsync(500);
    await headRejected;
    client.dispose();
  });

  it('starts a queued request timer only when that request becomes the head', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const first = client.validate(DEFAULT_PARAMS);
    const second = client.validate({ ...DEFAULT_PARAMS, text: 'SECOND' });
    const secondRejected = expect(second).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(400);
    worker.emit({ type: 'validation', requestId: 1, result: result() });
    await expect(first).resolves.toMatchObject({ generationId: 1 });
    await vi.advanceTimersByTimeAsync(499);
    expect(worker.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await secondRejected;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    client.dispose();
  });
});

describe('GeometryClient queued preview cache and dispatch timing', () => {
  const sentTypes = (worker: MockWorker) =>
    worker.postMessage.mock.calls.map(
      ([message]) => message as { type: string; requestId: number },
    );

  it('measures round trip and queue time from the moment a queued preview is dispatched', async () => {
    vi.useFakeTimers({ toFake: [...fakeClock] });
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 30_000 });
    const worker = MockWorker.instances[0];
    worker.emit({ type: 'ready', requestId: 0 });
    const active = client.request({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const queued = client.request(DEFAULT_PARAMS);
    const [, head] = sentTypes(worker);
    await vi.advanceTimersByTimeAsync(400);
    worker.emit({ type: 'geometry', requestId: head.requestId, result: result() });
    await activeRejected;
    const [, , next] = sentTypes(worker);
    await vi.advanceTimersByTimeAsync(100);
    worker.emit({ type: 'geometry', requestId: next.requestId, result: result() });
    const { timings } = await queued;
    expect(timings?.clientRoundTripMs).toBeCloseTo(100, 0);
    expect(timings?.clientQueueMs).toBeCloseTo(400, 0);
    client.dispose();
  });

  it('resolves a queued edit from the result cache without a new generate when its preview was cached before dispatch', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const active = client.request({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const queued = client.request(DEFAULT_PARAMS);
    const { resultCache } = client as unknown as {
      resultCache: { set(key: string, value: GeometryResult): void };
    };
    const { cacheKey } = client as unknown as {
      cacheKey(operation: 'preview', params: typeof DEFAULT_PARAMS): string;
    };
    resultCache.set(cacheKey('preview', DEFAULT_PARAMS), { ...result(), generationId: 1 });
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    await activeRejected;

    expect(sentTypes(worker).map((message) => message.type)).toEqual(['warmup', 'generate']);
    await expect(queued).resolves.toMatchObject({
      generationId: 2,
      timings: expect.objectContaining({ clientCacheHit: 1 }),
    });
    expect(sentTypes(worker).map((message) => message.type)).toEqual(['warmup', 'generate']);
    client.dispose();
  });

  it('supersedes the active and queued previews when a newer preview is served from the cache', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const { resultCache, cacheKey } = client as unknown as {
      resultCache: { set(key: string, value: GeometryResult): void };
      cacheKey(operation: 'preview', params: typeof DEFAULT_PARAMS): string;
    };
    resultCache.set(cacheKey('preview', DEFAULT_PARAMS), { ...result(), generationId: 1 });
    const active = client.request({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const queued = client.request({ ...DEFAULT_PARAMS, text: 'QUEUED' });
    const queuedRejected = expect(queued).rejects.toBeInstanceOf(GeometryCandidateSupersededError);

    const cached = await client.request(DEFAULT_PARAMS);
    expect(cached.timings).toEqual(expect.objectContaining({ clientCacheHit: 1 }));
    await activeRejected;
    await queuedRejected;

    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    expect(sentTypes(worker).map((message) => message.type)).toEqual(['warmup', 'generate']);
    client.dispose();
  });

  it('does not resolve a queued edit with inline font data from a cache entry keyed without that data', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const active = client.request({ ...DEFAULT_PARAMS, text: 'ACTIVE' });
    const activeRejected = expect(active).rejects.toBeInstanceOf(GeometryCandidateSupersededError);
    const font = { ...FONT_CATALOG[0]!, data: new ArrayBuffer(8) };
    const queued = client.request(DEFAULT_PARAMS, font, undefined);
    const { resultCache, cacheKey } = client as unknown as {
      resultCache: { set(key: string, value: GeometryResult): void };
      cacheKey(
        operation: 'preview',
        params: typeof DEFAULT_PARAMS,
        fontDefinition?: unknown,
      ): string;
    };
    resultCache.set(cacheKey('preview', DEFAULT_PARAMS, font), { ...result(), generationId: 1 });
    worker.emit({ type: 'geometry', requestId: 1, result: result() });
    await activeRejected;

    expect(sentTypes(worker).map((message) => message.type)).toEqual([
      'warmup',
      'generate',
      'generate',
    ]);
    worker.emit({ type: 'geometry', requestId: 2, result: result() });
    await expect(queued).resolves.toMatchObject({ generationId: 2 });
    client.dispose();
  });

  it('rejects structurally invalid results at identity stamping and acceptance', () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const invalid = { generationId: 1 } as unknown as GeometryResult;
    expect(() => client.identifyValidatedResult(invalid)).toThrow();
    expect(() => assertAcceptableResult(invalid)).toThrow();
    expect(() => assertAcceptableResult({ ...result(), generationId: 1 })).not.toThrow();
    client.dispose();
  });
});
