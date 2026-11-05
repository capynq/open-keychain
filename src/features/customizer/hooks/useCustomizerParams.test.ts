// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PARAMS,
  DEFAULT_PRINT_APPEARANCE,
  type GeometryResult,
  type KeychainParams,
  type GeometryValidation,
  type WorkerResponse,
} from '../../../domain/keychain/model/types';
import { GeometryClient } from '../../../infrastructure/geometry/geometry-client';
import { RecoveryError } from '../../../shared/lib/recovery/failure';
import { GeometryOperationError } from '../../../shared/lib/recovery/operation-diagnostics';
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

  it('tracks every randomized geometry validation outcome', async () => {
    const started: string[] = [];
    const finished: unknown[][] = [];
    const callbacks: CandidateCallbacks = {
      attemptStarted: (attemptId) => started.push(attemptId),
      attemptFinished: (...args) => finished.push(args),
    };
    const getApi = renderHook(callbacks);
    const validate = vi
      .fn()
      .mockResolvedValueOnce(invalidResult())
      .mockResolvedValueOnce({ ...validResult(), generationId: 81 } as GeometryResult);
    let transactionStatus: string | undefined;

    await act(async () => {
      transactionStatus = (await getApi().randomize(() => 0, validate)).status;
    });

    expect(transactionStatus).toBe('accepted');
    expect(validate).toHaveBeenCalledTimes(2);
    expect(started).toHaveLength(2);
    expect(new Set(started).size).toBe(2);
    expect(finished).toEqual([
      [
        started[0],
        'rejected',
        { code: 'candidate-invalid', message: 'Candidate is invalid.' },
        undefined,
        undefined,
      ],
      [started[1], 'accepted', undefined, undefined, 81],
    ]);
  });

  it('finishes an in-flight candidate attempt as superseded when randomization begins', async () => {
    const started: string[] = [];
    const finished: unknown[][] = [];
    let resolveCandidate!: (result: GeometryResult) => void;
    const pendingCandidate = new Promise<GeometryResult>((resolve) => {
      resolveCandidate = resolve;
    });
    const getApi = renderHook({
      validate: () => pendingCandidate,
      attemptStarted: (attemptId) => started.push(attemptId),
      attemptFinished: (...args) => finished.push(args),
    });

    act(() => getApi().update('baseThicknessMm', 2.5));
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(0);

    await act(async () => {
      await getApi().randomize(
        () => 0,
        async () => ({ ...validResult(), generationId: 81 }) as GeometryResult,
      );
    });

    expect(finished[0]).toEqual([started[0], 'superseded']);
    await act(async () => {
      resolveCandidate({ ...validResult(), generationId: 80 } as GeometryResult);
      await Promise.resolve();
    });
    expect(finished.filter(([attemptId]) => attemptId === started[0])).toEqual([
      [started[0], 'superseded'],
    ]);
  });

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

  it('undoes and redoes accepted edits in order and reports template switches', async () => {
    const { callbacks } = createCallbacks();
    const templateChanges: string[] = [];
    const getApi = renderHook({
      ...callbacks,
      templateChanging: (from, to) => templateChanges.push(`${from}>${to}`),
    });
    const worker = MockWorker.instances[0];
    const accept = async (requestId: number) =>
      act(async () => worker.emit({ type: 'validation', requestId, result: validResult() }));

    expect(getApi().canUndo).toBe(false);
    act(() => getApi().update('baseThicknessMm', 2.5));
    await accept(1);
    act(() => getApi().selectTemplate('nameplate'));
    await accept(2);
    expect(templateChanges).toEqual(['name-keychain>nameplate']);
    expect(getApi().canUndo).toBe(true);
    expect(getApi().undoKind).toBe('change');

    act(() => getApi().undo());
    await accept(3);
    expect(getApi().acceptedParams.templateId).toBe('name-keychain');
    expect(getApi().acceptedParams.baseThicknessMm).toBe(2.5);
    expect(templateChanges).toEqual(['name-keychain>nameplate', 'nameplate>name-keychain']);
    expect(getApi().canRedo).toBe(true);

    act(() => getApi().undo());
    await accept(4);
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
    expect(getApi().canUndo).toBe(false);

    act(() => getApi().redo());
    await accept(5);
    act(() => getApi().redo());
    await accept(6);
    expect(getApi().acceptedParams.templateId).toBe('nameplate');
    expect(getApi().canRedo).toBe(false);

    act(() => getApi().undo());
    await accept(7);
    act(() => getApi().update('baseThicknessMm', 3));
    await accept(8);
    expect(getApi().canRedo).toBe(false);
  });

  it('steps through color edits and parameter edits in one history', async () => {
    const { callbacks } = createCallbacks();
    let colors: { version: 1; base?: string } = { version: 1 };
    const getApi = renderHook({
      ...callbacks,
      appearance: { get: () => colors, set: (next) => (colors = next) },
    });
    const worker = MockWorker.instances[0];
    const editColor = (base: string) => {
      getApi().recordAppearanceEdit(colors);
      colors = { version: 1, base };
    };

    act(() => getApi().update('baseThicknessMm', 2.5));
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));
    act(() => editColor('#111111'));
    act(() => vi.advanceTimersByTime(1000));
    act(() => editColor('#222222'));
    act(() => vi.advanceTimersByTime(100));
    /* A drag through the native picker arrives as many edits; they form one step. */
    act(() => editColor('#333333'));

    act(() => getApi().undo());
    expect(colors.base).toBe('#111111');
    expect(getApi().canRedo).toBe(true);
    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    expect(getApi().acceptedParams.baseThicknessMm).toBe(2.5);

    act(() => getApi().redo());
    expect(colors.base).toBe('#111111');
    act(() => editColor('#444444'));
    expect(getApi().canRedo).toBe(false);

    act(() => getApi().undo());
    expect(colors.base).toBe('#111111');
    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    act(() => getApi().undo());
    await act(async () => worker.emit({ type: 'validation', requestId: 2, result: validResult() }));
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
    expect(getApi().canUndo).toBe(false);
  });

  it('keeps a color edit made while an undo is still being checked', async () => {
    const { callbacks } = createCallbacks();
    let colors: { version: 1; base?: string } = { version: 1 };
    const getApi = renderHook({
      ...callbacks,
      appearance: { get: () => colors, set: (next) => (colors = next) },
    });
    const worker = MockWorker.instances[0];

    act(() => getApi().update('baseThicknessMm', 2.5));
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));
    act(() => getApi().undo());
    act(() => {
      getApi().recordAppearanceEdit(colors);
      colors = { version: 1, base: '#111111' };
    });
    await act(async () => worker.emit({ type: 'validation', requestId: 2, result: validResult() }));
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
    expect(getApi().canUndo).toBe(true);

    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    expect(getApi().canUndo).toBe(false);
  });

  it('keeps action order when a color edit lands while a parameter edit is checked', async () => {
    const { callbacks } = createCallbacks();
    let colors: { version: 1; base?: string } = { version: 1 };
    const getApi = renderHook({
      ...callbacks,
      appearance: { get: () => colors, set: (next) => (colors = next) },
    });
    const worker = MockWorker.instances[0];
    const editColor = (base: string) => {
      getApi().recordAppearanceEdit(colors);
      colors = { version: 1, base };
    };

    act(() => getApi().update('baseThicknessMm', 2.5));
    act(() => editColor('#111111'));
    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    expect(getApi().canRedo).toBe(true);
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));
    /* The older parameter edit did not clear the color redo made after it. */
    expect(getApi().canRedo).toBe(true);
    act(() => getApi().redo());
    expect(colors.base).toBe('#111111');

    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    act(() => getApi().undo());
    await act(async () => worker.emit({ type: 'validation', requestId: 2, result: validResult() }));
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
  });

  it('does not revive redo when a color edit lands while an undo is checked', async () => {
    const { callbacks } = createCallbacks();
    let colors: { version: 1; base?: string } = { version: 1 };
    const getApi = renderHook({
      ...callbacks,
      appearance: { get: () => colors, set: (next) => (colors = next) },
    });
    const worker = MockWorker.instances[0];

    act(() => getApi().update('baseThicknessMm', 2.5));
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));
    act(() => getApi().undo());
    act(() => {
      getApi().recordAppearanceEdit(colors);
      colors = { version: 1, base: '#111111' };
    });
    await act(async () => worker.emit({ type: 'validation', requestId: 2, result: validResult() }));
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
    expect(getApi().canRedo).toBe(false);

    act(() => getApi().undo());
    expect(colors.base).toBeUndefined();
    act(() => getApi().redo());
    expect(colors.base).toBe('#111111');
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
  });

  it('keeps an undo an undo when its failed check is retried', async () => {
    let calls = 0;
    const validate = vi.fn(async () => {
      calls += 1;
      if (calls === 2)
        throw new GeometryOperationError(
          { code: 'geometry-request-timeout' },
          { stage: 'transport', type: 'timeout' },
        );
      return { ...validResult(), generationId: calls };
    });
    const getApi = renderHook({ validate });

    act(() => getApi().update('baseThicknessMm', 2.5));
    await act(async () => Promise.resolve());
    act(() => getApi().undo());
    await act(async () => Promise.resolve());
    expect(getApi().candidateFeedback?.status).toBe('failed');

    act(() => getApi().retryCandidate(getApi().candidateFeedback!.requestId));
    await act(async () => Promise.resolve());
    expect(getApi().acceptedParams.baseThicknessMm).toBe(DEFAULT_PARAMS.baseThicknessMm);
    expect(getApi().canUndo).toBe(false);
    expect(getApi().canRedo).toBe(true);
  });

  it('keeps an undo entry when its candidate is rejected', async () => {
    const { callbacks } = createCallbacks();
    const getApi = renderHook(callbacks);
    const worker = MockWorker.instances[0];

    act(() => getApi().update('baseThicknessMm', 2.5));
    await act(async () => worker.emit({ type: 'validation', requestId: 1, result: validResult() }));
    act(() => getApi().undo());
    await act(async () =>
      worker.emit({ type: 'validation', requestId: 2, result: invalidResult() }),
    );
    expect(getApi().acceptedParams.baseThicknessMm).toBe(2.5);
    expect(getApi().canUndo).toBe(true);
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

  it('routes an accept callback that throws to the rejection path instead of leaving the candidate checking', async () => {
    const { rejected, callbacks } = createCallbacks();
    const throwingCallbacks: CandidateCallbacks = {
      ...callbacks,
      accept: () => {
        throw new RecoveryError({ code: 'geometry-invalid-result' });
      },
    };
    const getApi = renderHook(throwingCallbacks);
    const worker = MockWorker.instances[0];

    act(() => getApi().update('text', 'GOOD'));
    await act(async () => {
      worker.emit({ type: 'validation', requestId: 1, result: validResult() });
    });
    expect(getApi().candidateFeedback?.status).not.toBe('checking');
    expect(getApi().candidateFeedback?.status).toBeDefined();
    expect(rejected).toEqual([DEFAULT_PARAMS.text]);
  });

  it('asks before applying a geometry measured parameter correction', async () => {
    const getApi = renderHook({
      validate: async () => ({
        ...validResult(),
        generationId: 40,
        parameterLimits: { cornerRadiusMm: 2 },
      }),
      validateRecovery: async () => ({ ...validResult(), generationId: 50 }),
    });
    const acceptedRadius = getApi().acceptedParams.cornerRadiusMm;

    act(() => getApi().update('cornerRadiusMm', 4));
    await act(async () => Promise.resolve());

    expect(getApi().params.cornerRadiusMm).toBe(acceptedRadius);
    expect(getApi().acceptedParams.cornerRadiusMm).toBe(acceptedRadius);
    expect(getApi().candidateFeedback).toMatchObject({
      status: 'rejected',
      failure: {
        code: 'geometry-parameter-limit',
        context: { parameter: 'cornerRadiusMm', maximumMm: 2, requestedMm: 4 },
      },
    });
    const requestId = getApi().candidateFeedback!.requestId;

    await act(async () => getApi().prepareRecovery(requestId));
    expect(getApi().recoveryOptions).toHaveLength(1);
    expect(getApi().recoveryOptions[0].status).toBe('ready');
    act(() => expect(getApi().applyRecovery(requestId, 'within-geometry-limit')).toBe(true));
    expect(getApi().acceptedParams.cornerRadiusMm).toBeLessThanOrEqual(2);
  });

  it('keeps a technical candidate failure distinct and retries the retained candidate explicitly', async () => {
    const retryFlags: boolean[] = [];
    const validate = vi.fn(async (...args: unknown[]) => {
      retryFlags.push(args[4] === true);
      if (retryFlags.length === 1)
        throw new GeometryOperationError(
          { code: 'geometry-request-timeout' },
          { stage: 'transport', type: 'timeout' },
        );
      return { ...validResult(), generationId: 12 };
    });
    const getApi = renderHook({ validate });

    act(() => getApi().update('text', 'NORA'));
    await act(async () => Promise.resolve());
    const feedback = getApi().candidateFeedback!;

    expect(feedback).toMatchObject({
      status: 'failed',
      failure: { code: 'geometry-request-timeout' },
      diagnostics: { stage: 'transport', type: 'timeout' },
    });
    expect(getApi().acceptedParams.text).toBe(DEFAULT_PARAMS.text);

    act(() => getApi().retryCandidate(feedback.requestId));
    await act(async () => Promise.resolve());
    expect(retryFlags).toEqual([false, true]);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(getApi().acceptedParams.text).toBe('NORA');
    expect(getApi().candidateFeedback).toBeUndefined();
  });

  it('offers Fix only for measured base edge failures and keeps generic build failures retry-only', async () => {
    const baseEdgeCallbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new GeometryOperationError(
            {
              code: 'base-edge-too-large',
              context: { target: 'base', maximumMm: 0.2, requestedMm: 0.6 },
            },
            { stage: 'generation', type: 'operation_error' },
          ),
        ),
    };
    const baseEdgeApi = renderHook(baseEdgeCallbacks);

    act(() => baseEdgeApi().update('text', 'NORA'));
    await act(async () => Promise.resolve());
    expect(baseEdgeApi().candidateFeedback).toMatchObject({
      status: 'rejected',
      failure: { code: 'base-edge-too-large' },
    });

    const genericCallbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new GeometryOperationError(
            { code: 'geometry-build-failed' },
            { stage: 'generation', type: 'operation_error' },
          ),
        ),
    };
    const genericApi = renderHook(genericCallbacks);

    act(() => genericApi().update('text', 'NORA'));
    await act(async () => Promise.resolve());
    expect(genericApi().candidateFeedback).toMatchObject({
      status: 'failed',
      failure: { code: 'geometry-build-failed' },
    });
  });

  it('prepares measured recovery options and applies the proved result without another validation', async () => {
    const recoveryValidations: string[] = [];
    const callbacks: CandidateCallbacks = {
      validate: () =>
        Promise.reject(
          new GeometryOperationError(
            {
              code: 'text-edge-too-large',
              context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.6 },
            },
            { stage: 'generation', type: 'operation_error' },
          ),
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
    expect(getApi().candidateFeedback?.status).toBe('rejected');
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

  it('keeps rejected text for envelope recovery and retains the accepted design until apply', async () => {
    const initialParams = { ...DEFAULT_PARAMS, sizeEnvelope: { widthMm: 40, heightMm: 20 } };
    const rejectedText = 'A LONG PLANT NAME';
    const accepted = vi.fn();
    const validateRecovery = vi.fn(async (params: KeychainParams) => ({
      ...validResult(),
      generationId: 91,
      printable: !params.sizeEnvelope,
      issues: params.sizeEnvelope
        ? [{ severity: 'error' as const, code: 'size-envelope-unavailable', message: 'Too small' }]
        : [],
    }));
    const getApi = renderHook(
      {
        accept: accepted,
        validate: async (params) =>
          params.text === initialParams.text
            ? { ...validResult(), generationId: 92 }
            : {
                ...invalidResult(),
                generationId: 90,
                issues: [
                  { severity: 'error', code: 'size-envelope-unavailable', message: 'Too small' },
                ],
              },
        validateRecovery,
      },
      initialParams,
    );

    act(() => getApi().updateText(rejectedText));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    const requestId = getApi().candidateFeedback!.requestId;

    expect(getApi().candidateFeedback?.status).toBe('rejected');
    expect(getApi().acceptedParams).toEqual(initialParams);
    expect(getApi().selectedFont.id).toBe(initialParams.fontId);
    expect(accepted).not.toHaveBeenCalled();

    await act(async () => getApi().prepareRecovery(requestId));
    expect(validateRecovery.mock.calls.every(([params]) => params.text === rejectedText)).toBe(
      true,
    );
    expect(getApi().recoveryOptions.map((option) => option.status)).toEqual([
      'unavailable',
      'ready',
    ]);
    expect(getApi().acceptedParams).toEqual(initialParams);
    expect(getApi().applyRecovery(requestId, 'larger-envelope')).toBe(false);
    act(() => expect(getApi().applyRecovery(requestId, 'natural-size')).toBe(true));
    expect(getApi().acceptedParams.text).toBe(rejectedText);
    expect(getApi().acceptedParams.sizeEnvelope).toBeUndefined();
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(getApi().undoKind).toBe('recovery');
    await act(async () => {
      getApi().undo();
      await Promise.resolve();
    });
    expect(getApi().params.text).toBe(initialParams.text);
    expect(getApi().params.sizeEnvelope).toEqual(initialParams.sizeEnvelope);
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
