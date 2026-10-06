import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type WorkerResponse,
} from '../../domain/keychain/model/types';
import { GeometryClient } from './geometry-client';

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
