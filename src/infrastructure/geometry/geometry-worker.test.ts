import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { serializeBinaryStl as SerializeBinaryStl } from '../export/stl-serializer';
import type { serializeThreeMf as SerializeThreeMf } from '../export/three-mf-serializer';

import { DEFAULT_PARAMS, DEFAULT_PRINT_APPEARANCE } from '../../domain/keychain/model/types';
import { RecoveryError } from '../../shared/lib/recovery/failure';

const mocks = vi.hoisted(() => ({
  buildKeychain: vi.fn(),
  createWasm: vi.fn(() => Promise.resolve({})),
  serializeBinaryStl: vi.fn<typeof SerializeBinaryStl>(() => new ArrayBuffer(4)),
  serializeThreeMf: vi.fn<typeof SerializeThreeMf>(() => new ArrayBuffer(4)),
  postMessage: vi.fn(),
}));
const { buildKeychain, createWasm, serializeBinaryStl, serializeThreeMf, postMessage } = mocks;

vi.mock('../../domain/keychain/build/keychain-builder', () => ({ buildKeychain, createWasm }));
vi.mock('../export/stl-serializer', () => ({ serializeBinaryStl }));
vi.mock('../export/three-mf-serializer', () => ({ serializeThreeMf }));

const makeMesh = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2]),
});
const makeBuilt = (includeExport: boolean) => {
  const baseMesh = makeMesh();
  const reliefMesh = makeMesh();
  return {
    result: {
      baseMesh,
      reliefMesh,
      dimensions: {
        widthMm: 1,
        heightMm: 1,
        thicknessMm: 1,
        centerMm: [0, 0, 0] as [number, number, number],
      },
      issues: [],
      printable: true,
      appearance: DEFAULT_PRINT_APPEARANCE,
    },
    ...(includeExport ? { exportMesh: makeMesh() } : {}),
  };
};

describe('geometry worker build quality and cache boundaries', () => {
  let handler: (event: MessageEvent) => Promise<void>;

  beforeEach(async () => {
    vi.resetAllMocks();
    createWasm.mockResolvedValue({});
    vi.stubGlobal('self', { postMessage });
    await vi.resetModules();
    const worker = await import('./geometry-worker');
    handler = (globalThis.self as unknown as { onmessage: typeof handler }).onmessage;
    expect(worker).toBeDefined();
    buildKeychain.mockImplementation((...args: unknown[]) =>
      Promise.resolve(makeBuilt(args[2] === true)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds preview once, never uses it for export, and reuses the export cache', async () => {
    const params = { ...DEFAULT_PARAMS, text: 'CACHE-BOUNDARY' };
    await handler({ data: { type: 'generate', requestId: 1, params } } as MessageEvent);
    await handler({ data: { type: 'validate', requestId: 2, params } } as MessageEvent);
    await handler({
      data: { type: 'export', requestId: 3, params, format: 'stl' },
    } as MessageEvent);
    await handler({
      data: { type: 'export', requestId: 4, params, format: 'stl' },
    } as MessageEvent);

    const cachedValidation = postMessage.mock.calls[1][0];
    expect(cachedValidation.result.timings).toMatchObject({
      workerCacheHit: 1,
      workerComputeMs: 0,
      generationMs: 0,
    });
    expect(cachedValidation.result.timings.workerCacheLookupMs).toBeGreaterThanOrEqual(0);
    expect(buildKeychain).toHaveBeenCalledTimes(2);
    expect(buildKeychain.mock.calls.map((call) => call[2])).toEqual([false, true]);
    expect(serializeBinaryStl).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'export', requestId: 4 }),
      expect.anything(),
    );
  });

  it('signals readiness only after WASM warmup resolves', async () => {
    await handler({ data: { type: 'warmup' } } as MessageEvent);

    expect(createWasm).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'ready', requestId: 0 });
  });

  it('serializes structured recovery failures from the build', async () => {
    buildKeychain.mockRejectedValueOnce(
      new RecoveryError({
        code: 'text-edge-too-large',
        message: 'too large',
        context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.4 },
      }),
    );
    await handler({
      data: { type: 'generate', requestId: 9, params: DEFAULT_PARAMS },
    } as MessageEvent);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        failure: {
          code: 'text-edge-too-large',
          message: 'too large',
          context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.4 },
        },
      }),
    );
  });
  it('reports initialization failure without an unhandled eager WASM rejection', async () => {
    createWasm.mockRejectedValueOnce(new Error('WASM unavailable'));
    await handler({ data: { type: 'warmup' } } as MessageEvent);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        requestId: 0,
        diagnostics: { stage: 'initialization', type: 'operation_error' },
      }),
    );
  });

  it('distinguishes serialization failures from geometry build failures', async () => {
    serializeThreeMf.mockImplementationOnce(() => {
      throw new Error('serializer failure');
    });
    await handler({
      data: { type: 'export', requestId: 3, params: DEFAULT_PARAMS, format: '3mf' },
    } as MessageEvent);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        requestId: 3,
        diagnostics: { stage: 'serialization', type: 'operation_error' },
      }),
    );
  });

  it('preserves cached mesh buffers across real transfers and repeated format switches', async () => {
    const delivered: unknown[] = [];
    postMessage.mockImplementation((response, options) => {
      delivered.push(structuredClone(response, { transfer: options?.transfer ?? [] }));
    });
    serializeBinaryStl.mockImplementation((mesh) => {
      expect(mesh.positions.byteLength).toBeGreaterThan(0);
      return new ArrayBuffer(4);
    });
    serializeThreeMf.mockImplementation((_result, mesh) => {
      expect(mesh.positions.byteLength).toBeGreaterThan(0);
      return new ArrayBuffer(4);
    });
    for (const [index, type] of (
      ['generate', 'validate', 'export', 'export', 'export'] as const
    ).entries()) {
      await handler({
        data: {
          type,
          requestId: index + 1,
          params: DEFAULT_PARAMS,
          format: index === 3 ? '3mf' : 'stl',
        },
      } as MessageEvent);
    }
    expect(delivered).toHaveLength(5);
    expect(delivered.slice(2)).toEqual([
      expect.objectContaining({ type: 'export', data: expect.any(ArrayBuffer) }),
      expect.objectContaining({ type: 'export', data: expect.any(ArrayBuffer) }),
      expect.objectContaining({ type: 'export', data: expect.any(ArrayBuffer) }),
    ]);
    expect(buildKeychain).toHaveBeenCalledTimes(2);
  });
});
