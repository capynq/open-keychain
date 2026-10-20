// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS, type ExportFormat, type ThreeMfMode } from '@/domain/keychain/model/types';
import { GeometryOperationError } from '@/shared/lib/recovery/operation-diagnostics';

import type { GeometryClient } from '../../../infrastructure/geometry/geometry-client';

import { useExportActions, type ExportActionsState } from './use-export-actions';

const telemetry = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('../../../infrastructure/telemetry/useTelemetry', () => ({
  useAnalytics: () => telemetry,
}));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;
let current!: ExportActionsState;
let exportMethod!: ReturnType<typeof vi.fn>;
let recoverForUserRetry!: ReturnType<typeof vi.fn>;

const file = (filename = 'design.stl') => ({
  filename,
  mimeType: 'model/stl',
  data: new ArrayBuffer(1),
});

const mount = (overrides: Partial<Parameters<typeof useExportActions>[0]> = {}) => {
  exportMethod = vi.fn().mockResolvedValue(file());
  recoverForUserRetry = vi.fn();
  const client = { export: exportMethod, recoverForUserRetry } as unknown as GeometryClient;
  const geometry = {
    clientRef: { current: client },
    result: undefined,
    current: true,
  } as Parameters<typeof useExportActions>[0]['geometry'];

  root = createRoot(host);

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const Harness = () => {
    current = useExportActions({
      geometry,
      params: DEFAULT_PARAMS,
      designId: 'design-id',
      ...overrides,
    });
    return null;
  };

  act(() => root!.render(createElement(Harness)));
};

const download = async (format: ExportFormat, mode?: ThreeMfMode) => {
  await act(async () => current.download(format, mode));
};

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  telemetry.track.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useExportActions', () => {
  it('recovers after a rejected export and gives the retry a new attempt with one terminal event', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce('attempt-1').mockReturnValueOnce('attempt-2'),
    });
    mount();
    exportMethod
      .mockReset()
      .mockRejectedValueOnce(
        new GeometryOperationError(
          { code: 'geometry-worker-failed', message: 'Geometry worker failed.' },
          { stage: 'transport', type: 'worker_unavailable' },
        ),
      )
      .mockResolvedValueOnce(file());
    await download('stl');

    expect(current.status).toBe('error');
    expect(recoverForUserRetry).toHaveBeenCalledTimes(1);
    expect(telemetry.track).toHaveBeenNthCalledWith(
      1,
      'export_started',
      expect.objectContaining({ export_attempt_id: 'attempt-1' }),
    );
    expect(telemetry.track).toHaveBeenNthCalledWith(
      2,
      'export_failed',
      expect.objectContaining({
        export_attempt_id: 'attempt-1',
        error_code: 'worker_failed',
        failure_stage: 'transport',
        error_type: 'worker_unavailable',
      }),
    );

    await act(async () => current.retry());

    expect(current.status).toBe('success');
    expect(recoverForUserRetry).toHaveBeenCalledTimes(2);
    expect(telemetry.track).toHaveBeenNthCalledWith(
      3,
      'export_started',
      expect.objectContaining({ export_attempt_id: 'attempt-2' }),
    );
    expect(telemetry.track).toHaveBeenNthCalledWith(
      4,
      'export_completed',
      expect.objectContaining({ export_attempt_id: 'attempt-2', outcome: 'success' }),
    );
    expect(telemetry.track).toHaveBeenCalledTimes(4);
  });

  it('allows only one same-tick export and supports switching between formats', async () => {
    let resolveFirst!: (value: ReturnType<typeof file>) => void;

    mount();
    exportMethod.mockImplementation(
      () => new Promise<ReturnType<typeof file>>((resolve) => (resolveFirst = resolve)),
    );
    let first!: Promise<void>;
    let second!: Promise<void>;

    act(() => {
      first = current.download('stl');
      second = current.download('3mf', 'merged');
    });
    expect(exportMethod).toHaveBeenCalledTimes(1);
    resolveFirst(file());
    await act(async () => {
      await first;
      await second;
    });
    expect(current.status).toBe('success');

    exportMethod.mockResolvedValueOnce(file('design.3mf'));
    await download('3mf', 'merged');
    expect(exportMethod).toHaveBeenLastCalledWith(
      DEFAULT_PARAMS,
      '3mf',
      'merged',
      undefined,
      undefined,
      undefined,
      false,
    );
    expect(telemetry.track).toHaveBeenLastCalledWith(
      'export_completed',
      expect.objectContaining({ format: '3mf', mode: 'merged', outcome: 'success' }),
    );
  });

  it.each(['worker_error', 'worker_unavailable'] as const)(
    'retains worker_failed for %s',
    async (type) => {
      mount();
      exportMethod.mockRejectedValueOnce(
        new GeometryOperationError(
          { code: 'geometry-worker-failed', message: 'Geometry worker failed.' },
          { stage: 'transport', type },
        ),
      );
      await download('stl');
      expect(telemetry.track).toHaveBeenLastCalledWith(
        'export_failed',
        expect.objectContaining({
          error_code: 'worker_failed',
          error_type: type,
          failure_stage: 'transport',
        }),
      );
    },
  );

  it('resets loading and reports a download diagnostic when browser click fails', async () => {
    const createObjectURL = vi.fn(() => 'blob:design');
    const revokeObjectURL = vi.fn();

    mount();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('download blocked');
    });
    await download('stl');

    expect(current.downloading).toBe(false);
    expect(current.status).toBe('error');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:design');
    expect(telemetry.track).toHaveBeenLastCalledWith(
      'export_failed',
      expect.objectContaining({
        error_code: 'export_failed',
        failure_stage: 'download',
        error_type: 'operation_error',
      }),
    );
  });

  it('resets loading when recovery throws before export starts', async () => {
    mount();
    recoverForUserRetry.mockImplementation(() => {
      throw new Error('worker unavailable');
    });
    await download('stl');

    expect(current.downloading).toBe(false);
    expect(current.status).toBe('error');
    expect(exportMethod).not.toHaveBeenCalled();
  });

  it.each([
    [{ stage: 'initialization', type: 'operation_error' }, 'worker_failed'],
    [{ stage: 'generation', type: 'operation_error' }, 'geometry_failed'],
    [{ stage: 'serialization', type: 'operation_error' }, 'export_failed'],
    [{ stage: 'transport', type: 'operation_error' }, 'export_failed'],
    [{ stage: 'download', type: 'message_error' }, 'worker_failed'],
    [{ stage: 'transport', type: 'timeout' }, 'timeout'],
  ] as const)('maps %o diagnostics to the safe legacy error code %s', async (diagnostics, code) => {
    mount();
    exportMethod.mockRejectedValueOnce(
      new GeometryOperationError({ code: 'operation-failed' }, diagnostics),
    );

    await download('stl');

    expect(telemetry.track).toHaveBeenLastCalledWith(
      'export_failed',
      expect.objectContaining({ error_code: code }),
    );
  });
});
