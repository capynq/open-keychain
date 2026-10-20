// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type GeometryResult,
  type GeometryValidation,
  type WorkerResponse,
} from '../../../domain/keychain/model/types';
import { GeometryClient } from '../../../infrastructure/geometry/geometry-client';
import { RecoveryError } from '../../../shared/lib/recovery/failure';
import { useCustomizerParams, type CandidateCallbacks } from './useCustomizerParams';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    MockWorker.instances.push(this);
  }

  emit(response: WorkerResponse): void {
    this.onmessage?.(new MessageEvent<WorkerResponse>('message', { data: response }));
  }
}

const validResult = (): GeometryValidation => ({
  baseMesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
  reliefMesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
  dimensions: {
    widthMm: 1,
    heightMm: 1,
    thicknessMm: 1,
    centerMm: [0, 0, 0],
  },
  issues: [],
  printable: true,
  appearance: DEFAULT_PRINT_APPEARANCE,
  parts: [
    {
      id: 'base',
      name: 'Base',
      role: 'base',
      mesh: { positions: new Float32Array([0, 0, 0]), indices: new Uint32Array([0, 0, 0]) },
    },
  ],
});

const invalidResult = (): GeometryValidation => ({
  ...validResult(),
  printable: false,
  issues: [{ severity: 'error', code: 'candidate-invalid', message: 'Candidate is invalid.' }],
});

describe('useCustomizerParams candidate scheduling', () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  let client: GeometryClient | undefined;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('Worker', MockWorker);
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => root?.unmount());
    client?.dispose();
    host?.remove();
    root = undefined;
    host = undefined;
    client = undefined;
    MockWorker.instances.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderHook = (callbacks: CandidateCallbacks, initialParams?: typeof DEFAULT_PARAMS) => {
    let current: ReturnType<typeof useCustomizerParams> | undefined;
    const Harness = () => {
      current = useCustomizerParams(initialParams, callbacks);
      return null;
    };

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root?.render(createElement(Harness)));
    return () => current as ReturnType<typeof useCustomizerParams>;
  };

  const createCallbacks = () => {
    client = new GeometryClient();
    const accepted: string[] = [];
    const rejected: string[] = [];
    const callbacks: CandidateCallbacks = {
      pending: () => client?.cancelCandidate(),
      validate: (params, font, subtitleFont) =>
        client?.validateCandidate(params, font, subtitleFont) ??
        Promise.reject(new Error('no client')),
      accept: (params) => accepted.push(params.text),
      reject: (params) => rejected.push(params.text),
    };

    return { accepted, rejected, callbacks };
  };

  it('keeps one active request and one latest queued request across continuous updates', async () => {
    const { accepted, rejected, callbacks } = createCallbacks();
    const getApi = renderHook(callbacks);
    const worker = MockWorker.instances[0];

    act(() => getApi().update('text', 'ONE', 'continuous'));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(32));
    act(() => getApi().update('text', 'TWO', 'continuous'));
    act(() => vi.advanceTimersByTime(32));
    act(() => getApi().update('text', 'THREE', 'continuous'));
    act(() => vi.advanceTimersByTime(32));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);

    await act(async () => {
      worker.emit({ type: 'validation', requestId: 1, result: validResult() });
    });
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'validate',
        requestId: 3,
        params: expect.objectContaining({ text: 'THREE' }),
      }),
    );
    await act(async () => {
      worker.emit({ type: 'validation', requestId: 3, result: validResult() });
    });
    expect(getApi().acceptedParams.text).toBe('THREE');
    expect(getApi().params.text).toBe('THREE');
    expect(accepted).toEqual(['THREE']);
    expect(rejected).toEqual([]);
    expect(getApi().candidateFeedback).toBeUndefined();
  });

  it('dispatches text after 100ms, immediate choices without delay, and cancels on unmount', async () => {
    const { callbacks } = createCallbacks();
    const getApi = renderHook(callbacks);
    const worker = MockWorker.instances[0];

    act(() => getApi().update('baseThicknessMm', 2.5));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));

    act(() => getApi().updateText('TEXT'));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(99));
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1));
    expect(worker.postMessage).toHaveBeenCalledTimes(3);

    act(() => getApi().updateText('UNMOUNTED'));
    act(() => root?.unmount());
    act(() => vi.advanceTimersByTime(100));
    expect(worker.postMessage).toHaveBeenCalledTimes(3);
  });

  it('restores accepted params after a rejected candidate', async () => {
    const { accepted, rejected, callbacks } = createCallbacks();
    const getApi = renderHook(callbacks);
    const worker = MockWorker.instances[0];

    act(() => getApi().update('text', 'BAD'));
    expect(getApi().params.text).toBe('BAD');
    await act(async () => {
      worker.emit({ type: 'validation', requestId: 1, result: invalidResult() });
    });
    expect(getApi().params.text).toBe(DEFAULT_PARAMS.text);
    expect(getApi().acceptedParams.text).toBe(DEFAULT_PARAMS.text);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([DEFAULT_PARAMS.text]);
    expect(getApi().candidateFeedback?.status).toBe('rejected');
  });

  it('prepares measured recovery options and applies the proved result without another validation', async () => {
    const recoveryValidations: string[] = [];
    const callbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new RecoveryError({
            code: 'text-edge-too-large',
            context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.6 },
          }),
        ),
      validateRecovery: (params) => {
        recoveryValidations.push(`${params.fontId}:${params.textEdgeFinish ?? ''}`);
        return Promise.resolve({ ...validResult(), generationId: 1 } satisfies GeometryResult);
      },
    };
    const initialParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      textEdgeFinish: 'round',
      textEdgeMm: 0.6,
    };
    const getApi = renderHook(callbacks, initialParams);

    act(() => getApi().update('fontId', 'quicksand'));
    await act(async () => Promise.resolve());
    const requestId = getApi().candidateFeedback?.requestId;

    expect(requestId).toEqual(expect.any(Number));
    expect(getApi().params.fontId).toBe(DEFAULT_PARAMS.fontId);
    await act(async () => getApi().prepareRecovery(requestId!));
    expect(getApi().recoveryOptions.map((option) => option.status)).toEqual(['ready', 'ready']);
    expect(recoveryValidations).toEqual(['quicksand:round', 'quicksand:sharp']);
    let applied = false;

    act(() => {
      applied = getApi().applyRecovery(requestId!, 'smaller-edge');
    });
    expect(applied).toBe(true);
    expect(getApi().acceptedParams.fontId).toBe('quicksand');
    expect(getApi().acceptedParams.textEdgeMm).toBe(0.2);
    expect(getApi().undoKind).toBe('recovery');
    expect(recoveryValidations).toHaveLength(2);
  });

  it('invalidates delayed recovery validation after a new edit', async () => {
    let resolveRepair: ((result: GeometryResult) => void) | undefined;
    const callbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new RecoveryError({
            code: 'text-edge-too-large',
            context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.6 },
          }),
        ),
      validateRecovery: () =>
        new Promise<GeometryResult>((resolve) => {
          resolveRepair = resolve;
        }),
    };
    const initialParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      textEdgeFinish: 'round',
      textEdgeMm: 0.6,
    };
    const getApi = renderHook(callbacks, initialParams);

    act(() => getApi().update('fontId', 'quicksand'));
    await act(async () => Promise.resolve());
    const requestId = getApi().candidateFeedback?.requestId;
    let preparing: Promise<void> | undefined;

    act(() => {
      preparing = getApi().prepareRecovery(requestId!);
    });

    await act(async () => Promise.resolve());

    expect(getApi().recoveryChecking).toBe(true);
    act(() => getApi().update('text', 'NEW'));
    act(() => resolveRepair?.({ ...validResult(), generationId: 1 }));
    await act(async () => preparing);
    expect(getApi().recoveryOptions).toEqual([]);
    expect(getApi().acceptedParams).toEqual(initialParams);
  });

  it('keeps failed recovery proposals unavailable and unapplied', async () => {
    const callbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new RecoveryError({
            code: 'text-edge-too-large',
            context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.6 },
          }),
        ),
      validateRecovery: () => Promise.reject(new RecoveryError({ code: 'geometry-build-failed' })),
    };
    const initialParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      textEdgeFinish: 'round',
      textEdgeMm: 0.6,
    };
    const getApi = renderHook(callbacks, initialParams);

    act(() => getApi().update('fontId', 'quicksand'));
    await act(async () => Promise.resolve());
    const requestId = getApi().candidateFeedback?.requestId;

    await act(async () => getApi().prepareRecovery(requestId!));
    expect(getApi().recoveryOptions.every((option) => option.status === 'unavailable')).toBe(true);
    act(() => {
      expect(getApi().applyRecovery(requestId!, 'sharp-edge')).toBe(false);
    });
    expect(getApi().acceptedParams).toEqual(initialParams);
  });
  it('rejects a prepared fix when the provider font revision changes', async () => {
    const getApi = renderHook(
      {
        validate: async () => {
          throw new RecoveryError({ code: 'text-edge-too-large', context: { maximumMm: 0.2 } });
        },
        validateRecovery: async () => ({ ...validResult(), generationId: 1 }),
      },
      { ...DEFAULT_PARAMS, textEdgeFinish: 'round', textEdgeMm: 0.6 },
    );

    act(() => getApi().update('fontId', 'quicksand'));
    await act(async () => Promise.resolve());
    const requestId = getApi().candidateFeedback!.requestId;

    await act(async () => getApi().prepareRecovery(requestId));
    const font = getApi().fontForId('quicksand');
    const revision = font.dataRevision;
    try {
      font.dataRevision = 'changed-after-verification';
      act(() => {
        expect(getApi().applyRecovery(requestId, 'smaller-edge')).toBe(false);
      });
      expect(getApi().acceptedParams.fontId).toBe(DEFAULT_PARAMS.fontId);
    } finally {
      font.dataRevision = revision;
    }
  });
});
