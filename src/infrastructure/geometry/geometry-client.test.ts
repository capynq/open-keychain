import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type WorkerResponse,
} from '../../domain/keychain/model/types';
import { RecoveryError } from '../../shared/lib/recovery/failure';
import { GeometryCandidateSupersededError, GeometryClient } from './geometry-client';

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

  it('does not start a queued candidate watchdog before dispatch', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient({ requestTimeoutMs: 500 });
    const worker = MockWorker.instances[0];
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
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const original = MockWorker.instances[0];
    original.onerror?.();
    MockWorker.instances[1].onmessageerror?.();
    await expect(client.export(DEFAULT_PARAMS)).rejects.toMatchObject({
      diagnostics: { type: 'worker_unavailable' },
    });
    expect(MockWorker.instances).toHaveLength(2);
    client.recoverForUserRetry();
    const replacement = MockWorker.instances[2];
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
    expect(MockWorker.instances).toHaveLength(3);
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
