import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS, DEFAULT_PRINT_APPEARANCE } from '../../domain/keychain/model/types';

const mocks = vi.hoisted(() => ({
  buildKeychain: vi.fn(),
  createWasm: vi.fn(() => Promise.resolve({})),
  serializeBinaryStl: vi.fn(() => new ArrayBuffer(4)),
  serializeThreeMf: vi.fn(() => new ArrayBuffer(4)),
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

    expect(buildKeychain).toHaveBeenCalledTimes(2);
    expect(buildKeychain.mock.calls.map((call) => call[2])).toEqual([false, true]);
    expect(serializeBinaryStl).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'export', requestId: 4 }),
      expect.anything(),
    );
  });
});
