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
  MockWorker.instances.length = 0;
  vi.unstubAllGlobals();
});

describe('GeometryClient lifecycle', () => {
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

  it('rejects all pending operations when the worker fails', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const preview = client.request(DEFAULT_PARAMS);
    const exportPromise = client.export(DEFAULT_PARAMS);
    const validation = client.validate(DEFAULT_PARAMS);
    worker.onerror?.();
    await expect(preview).rejects.toThrow('worker failed');
    await expect(exportPromise).rejects.toThrow('worker failed');
    await expect(validation).rejects.toThrow('worker failed');
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
    await expect(client.request(DEFAULT_PARAMS)).rejects.toThrow('worker failed');
    expect(worker.postMessage).toHaveBeenCalledTimes(4);
  });

  it('handles message deserialization failures and rejects later calls without posting', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const client = new GeometryClient();
    const worker = MockWorker.instances[0];
    const pending = client.request(DEFAULT_PARAMS);
    worker.onmessageerror?.();
    await expect(pending).rejects.toThrow('worker failed');
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    await expect(client.validate(DEFAULT_PARAMS)).rejects.toThrow('worker failed');
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
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
