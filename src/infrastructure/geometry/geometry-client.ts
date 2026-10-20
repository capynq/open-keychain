import type { FontDefinition } from '../../domain/keychain/fonts/catalog';
import type {
  ExportFormat,
  GeometryResult,
  KeychainParams,
  ThreeMfMode,
  WorkerRequest,
  WorkerResponse,
  PrintAppearanceOverrides,
} from '../../domain/keychain/model/types';

import { validateGeometryResult } from '../../domain/keychain/model/types';
import { RecoveryError, failureFrom } from '../../shared/lib/recovery/failure';
import {
  GeometryOperationError,
  type OperationDiagnostics,
} from '../../shared/lib/recovery/operation-diagnostics';
import { BoundedResultCache } from './result-cache';

const disposedError = () =>
  new RecoveryError({ code: 'geometry-client-disposed', message: 'Geometry client disposed.' });
const failedError = (type: OperationDiagnostics['type'] = 'worker_unavailable') =>
  new GeometryOperationError(
    { code: 'geometry-worker-failed', message: 'Geometry worker failed.' },
    { stage: 'transport', type },
  );
export const DEFAULT_GEOMETRY_REQUEST_TIMEOUT_MS = 30_000;

export class GeometryRequestTimeoutError extends GeometryOperationError {
  constructor() {
    super(
      { code: 'geometry-request-timeout', message: 'Geometry worker request timed out.' },
      { stage: 'transport', type: 'timeout' },
    );
    this.name = 'GeometryRequestTimeoutError';
  }
}

export class GeometryCandidateSupersededError extends Error {
  constructor() {
    super('Geometry candidate was superseded.');
    this.name = 'GeometryCandidateSupersededError';
    Object.defineProperty(this, 'failure', {
      value: { code: 'geometry-candidate-superseded', message: this.message },
      enumerable: true,
    });
  }
}

export type GeometryClientOptions = {
  requestTimeoutMs?: number;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as object)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
};

const fontKey = (font: FontDefinition | undefined): string => {
  if (!font) return '-';
  const metadata = Object.fromEntries(Object.entries(font).filter(([key]) => key !== 'data'));
  return stableStringify(metadata);
};
const hasInlineFontData = (...fonts: (FontDefinition | undefined)[]): boolean =>
  fonts.some((font) => font?.data !== undefined);

const cloneResult = (result: GeometryResult, generationId: number): GeometryResult => {
  // structuredClone preserves shared ArrayBuffer identity between aggregate meshes and parts.
  const clone = structuredClone(result);
  clone.generationId = generationId;
  return clone;
};

const geometryResultWeight = (result: GeometryResult): number => {
  const buffers = new Set<ArrayBufferLike>();
  const meshes = [
    result.baseMesh,
    result.reliefMesh,
    ...(result.parts ?? []).map((part) => part.mesh),
  ];
  for (const mesh of meshes) {
    buffers.add(mesh.positions.buffer);
    buffers.add(mesh.indices.buffer);
  }
  let total = 0;
  for (const buffer of buffers) total += buffer.byteLength;
  return total;
};

export class GeometryClient {
  private worker: Worker;
  private readonly requestTimeoutMs: number;
  private readonly requestTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextRequestId = 1;
  private activePreviewRequestId: number | undefined;
  private queuedPreview:
    | {
        params: KeychainParams;
        fontDefinition?: FontDefinition;
        subtitleFontDefinition?: FontDefinition;
        requestId: number;
        cacheKey?: string;
      }
    | undefined;
  private readonly pendingGeometry = new Map<
    number,
    { resolve: (result: GeometryResult) => void; reject: (error: Error) => void; startedAt: number }
  >();
  private readonly pendingExports = new Map<
    number,
    {
      resolve: (file: { filename: string; mimeType: string; data: ArrayBuffer }) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly pendingValidations = new Map<
    number,
    {
      resolve: (result: GeometryResult) => void;
      reject: (error: Error) => void;
      startedAt: number;
      queueMs?: number;
    }
  >();
  private activeCandidateRequestId: number | undefined;
  private queuedCandidate:
    | {
        params: KeychainParams;
        fontDefinition?: FontDefinition;
        subtitleFontDefinition?: FontDefinition;
        requestId: number;
        cacheKey?: string;
      }
    | undefined;
  private disposed = false;
  private workerFailed = false;
  private recoveryAvailable = true;
  private readonly resultCache = new BoundedResultCache<GeometryResult>(
    8,
    64 * 1024 * 1024,
    geometryResultWeight,
  );
  constructor(options: GeometryClientOptions = {}) {
    this.requestTimeoutMs =
      options.requestTimeoutMs && Number.isFinite(options.requestTimeoutMs)
        ? Math.max(1, options.requestTimeoutMs)
        : DEFAULT_GEOMETRY_REQUEST_TIMEOUT_MS;
    this.worker = this.createWorker();
    try {
      this.worker.postMessage({ type: 'warmup' } satisfies WorkerRequest);
    } catch (error) {
      this.handleWorkerFailure(this.worker, error instanceof Error ? error : failedError());
    }
  }
  request(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<GeometryResult> {
    if (this.disposed || this.workerFailed) return Promise.reject(this.currentError());
    const requestId = this.nextRequestId++;
    const cacheKey = this.cacheKey('preview', params, fontDefinition, subtitleFontDefinition);
    const cacheable = !hasInlineFontData(fontDefinition, subtitleFontDefinition);
    const cached = cacheable ? this.resultCache.get(cacheKey) : undefined;
    if (cached) return Promise.resolve(this.cloneCachedResult(cached, requestId));
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingGeometry.set(requestId, { resolve, reject, startedAt: performance.now() });
    });
    if (this.activePreviewRequestId !== undefined) {
      const stale = this.pendingGeometry.get(this.activePreviewRequestId);
      stale?.reject(new GeometryCandidateSupersededError());
      this.pendingGeometry.delete(this.activePreviewRequestId);
      if (this.queuedPreview) {
        const superseded = this.pendingGeometry.get(this.queuedPreview.requestId);
        superseded?.reject(new GeometryCandidateSupersededError());
        this.pendingGeometry.delete(this.queuedPreview.requestId);
      }
      this.queuedPreview = { params, fontDefinition, requestId, subtitleFontDefinition, cacheKey };
      return promise;
    }
    this.sendGenerate(
      params,
      fontDefinition,
      requestId,
      subtitleFontDefinition,
      cacheable ? cacheKey : undefined,
    );
    return promise;
  }
  export(
    params: KeychainParams,
    format: ExportFormat = 'stl',
    mode: ThreeMfMode = 'separate-colors',
    fontDefinition?: FontDefinition,
    appearanceOverrides?: PrintAppearanceOverrides,
    subtitleFontDefinition?: FontDefinition,
    allowDisconnected = false,
  ): Promise<{
    filename: string;
    mimeType: string;
    data: ArrayBuffer;
  }> {
    if (this.disposed || this.workerFailed) return Promise.reject(this.currentError());
    const requestId = this.nextRequestId++;
    const promise = new Promise<{
      filename: string;
      mimeType: string;
      data: ArrayBuffer;
    }>((resolve, reject) => {
      this.pendingExports.set(requestId, { resolve, reject });
    });
    try {
      this.worker.postMessage({
        type: 'export',
        requestId,
        params,
        format,
        mode,
        appearanceOverrides,
        allowDisconnected,
        fontDefinition: this.fontForWorker(fontDefinition),
        subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
      } satisfies WorkerRequest);
    } catch (error) {
      this.pendingExports.delete(requestId);
      return Promise.reject(error instanceof Error ? error : failedError());
    }
    this.startRequestTimer(requestId, this.worker);
    return promise;
  }
  /** Validate a candidate independently of the coalesced preview request. */
  validate(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<GeometryResult> {
    if (this.disposed || this.workerFailed) return Promise.reject(this.currentError());
    const requestId = this.nextRequestId++;
    const cacheKey = this.cacheKey('validation', params, fontDefinition, subtitleFontDefinition);
    const cacheable = !hasInlineFontData(fontDefinition, subtitleFontDefinition);
    const cached = cacheable ? this.resultCache.get(cacheKey) : undefined;
    if (cached) return Promise.resolve(this.cloneCachedResult(cached, requestId));
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingValidations.set(requestId, { resolve, reject, startedAt: performance.now() });
    });
    if (cacheable) this.validationCacheKeys.set(requestId, cacheKey);
    this.sendValidate(params, fontDefinition, subtitleFontDefinition, requestId);
    return promise;
  }
  /** Validate the latest interactive candidate, coalescing work to one active and one queued request. */
  validateCandidate(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<GeometryResult> {
    if (this.disposed || this.workerFailed) return Promise.reject(this.currentError());
    const requestId = this.nextRequestId++;
    const cacheKey = this.cacheKey('validation', params, fontDefinition, subtitleFontDefinition);
    const cacheable = !hasInlineFontData(fontDefinition, subtitleFontDefinition);
    const lookupStartedAt = performance.now();
    const cached = cacheable ? this.resultCache.get(cacheKey) : undefined;
    if (this.activeCandidateRequestId !== undefined)
      this.supersedeCandidate(this.activeCandidateRequestId);
    if (this.queuedCandidate) this.supersedeCandidate(this.queuedCandidate.requestId);
    this.queuedCandidate = undefined;
    if (cached) return Promise.resolve(this.cloneCachedResult(cached, requestId, lookupStartedAt));
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingValidations.set(requestId, { resolve, reject, startedAt: lookupStartedAt });
    });
    if (cacheable) this.validationCacheKeys.set(requestId, cacheKey);
    const request = { params, fontDefinition, subtitleFontDefinition, requestId, cacheKey };
    if (this.activeCandidateRequestId !== undefined) {
      this.queuedCandidate = request;
    } else {
      this.activeCandidateRequestId = requestId;
      this.sendValidate(params, fontDefinition, subtitleFontDefinition, requestId, true);
    }
    return promise;
  }

  cancelCandidate(): void {
    if (this.activeCandidateRequestId !== undefined)
      this.supersedeCandidate(this.activeCandidateRequestId);
    if (this.queuedCandidate) this.supersedeCandidate(this.queuedCandidate.requestId);
    this.queuedCandidate = undefined;
  }
  /** Give a validated external/background result a unique generation in this editor session. */
  identifyValidatedResult(result: GeometryResult): GeometryResult {
    if (this.disposed || this.workerFailed) throw this.currentError();
    if (!validateGeometryResult(result))
      throw new RecoveryError({ code: 'geometry-invalid-result' });
    return { ...result, generationId: this.nextRequestId++ };
  }

  /** Re-arm a failed client only in response to an explicit user retry. Never replay old work. */
  recoverForUserRetry(): void {
    if (this.disposed) throw disposedError();
    if (!this.workerFailed) return;
    this.recoveryAvailable = false;
    this.replaceWorker();
    if (this.workerFailed) throw failedError();
  }

  dispose(): void {
    this.disposed = true;
    const error = disposedError();
    for (const pending of this.pendingGeometry.values()) pending.reject(error);
    for (const pending of this.pendingExports.values()) pending.reject(error);
    for (const pending of this.pendingValidations.values()) pending.reject(error);
    this.pendingGeometry.clear();
    this.pendingExports.clear();
    this.pendingValidations.clear();
    this.clearRequestTimers();
    this.queuedPreview = undefined;
    this.activePreviewRequestId = undefined;
    this.queuedCandidate = undefined;
    this.activeCandidateRequestId = undefined;
    this.resultCache.clear();
    this.worker.terminate();
  }
  private sendGenerate(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    requestId = this.nextRequestId++,
    subtitleFontDefinition?: FontDefinition,
    cacheKey?: string,
  ): void {
    this.activePreviewRequestId = requestId;
    try {
      this.worker.postMessage({
        type: 'generate',
        requestId,
        params,
        fontDefinition: this.fontForWorker(fontDefinition),
        subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
      } satisfies WorkerRequest);
    } catch (error) {
      this.pendingGeometry.get(requestId)?.reject(error instanceof Error ? error : failedError());
      this.pendingGeometry.delete(requestId);
      this.previewCacheKeys.delete(requestId);
      this.activePreviewRequestId = undefined;
      return;
    }
    this.startRequestTimer(requestId, this.worker);
    if (cacheKey) this.previewCacheKeys.set(requestId, cacheKey);
  }
  private sendValidate(
    params: KeychainParams,
    fontDefinition: FontDefinition | undefined,
    subtitleFontDefinition: FontDefinition | undefined,
    requestId: number,
    candidate = false,
  ): void {
    try {
      this.worker.postMessage({
        type: 'validate',
        requestId,
        params,
        fontDefinition: this.fontForWorker(fontDefinition),
        subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
      } satisfies WorkerRequest);
    } catch (error) {
      this.pendingValidations
        .get(requestId)
        ?.reject(error instanceof Error ? error : failedError());
      this.pendingValidations.delete(requestId);
      this.validationCacheKeys.delete(requestId);
      if (candidate) {
        this.activeCandidateRequestId = undefined;
        this.rejectQueuedCandidate(error instanceof Error ? error : failedError());
      }
      return;
    }
    this.startRequestTimer(requestId, this.worker);
    const pending = this.pendingValidations.get(requestId);
    if (pending) pending.queueMs = Math.max(0, performance.now() - pending.startedAt);
  }
  private handleResponse(worker: Worker, response: WorkerResponse): void {
    if (this.disposed || worker !== this.worker) return;
    this.clearRequestTimer(response.requestId);
    if (response.type === 'error' && response.requestId === 0) {
      this.handleWorkerFailure(
        worker,
        new GeometryOperationError(
          response.failure ?? { code: 'geometry-worker-failed', message: response.message },
          { stage: 'initialization', type: 'operation_error' },
        ),
      );
      return;
    }
    this.recoveryAvailable = true;
    if (response.type === 'geometry') {
      const pending = this.pendingGeometry.get(response.requestId);
      if (pending) {
        const result = { ...response.result, generationId: response.requestId };
        if (!validateGeometryResult(result)) {
          pending.reject(
            new RecoveryError({
              code: 'geometry-invalid-result',
              message: 'Geometry worker returned an invalid result.',
            }),
          );
        } else {
          const cacheKey = this.previewCacheKeys.get(response.requestId);
          const cloneStartedAt = performance.now();
          if (cacheKey) this.resultCache.set(cacheKey, cloneResult(result, 0));
          result.timings = {
            ...result.timings,
            clientCacheCloneMs: performance.now() - cloneStartedAt,
            clientRoundTripMs: performance.now() - pending.startedAt,
          };
          pending.resolve(result);
        }
        this.pendingGeometry.delete(response.requestId);
        this.previewCacheKeys.delete(response.requestId);
      }
      if (this.activePreviewRequestId === response.requestId) {
        this.activePreviewRequestId = undefined;
      }
      const latest = this.queuedPreview;
      if (latest) {
        this.queuedPreview = undefined;
        this.sendGenerate(
          latest.params,
          latest.fontDefinition,
          latest.requestId,
          latest.subtitleFontDefinition,
          latest.cacheKey,
        );
      }
      return;
    }
    if (response.type === 'validation') {
      const pending = this.pendingValidations.get(response.requestId);
      const result = { ...response.result, generationId: response.requestId };
      if (pending) {
        if (!validateGeometryResult(result))
          pending.reject(
            new RecoveryError({
              code: 'geometry-invalid-result',
              message: 'Geometry worker returned an invalid validation result.',
            }),
          );
        else {
          const cacheKey = this.validationCacheKeys.get(response.requestId);
          const cloneStartedAt = performance.now();
          if (cacheKey) this.resultCache.set(cacheKey, cloneResult(result, 0));
          result.timings = {
            ...result.timings,
            clientCacheCloneMs: performance.now() - cloneStartedAt,
            clientRoundTripMs: performance.now() - pending.startedAt,
            clientQueueMs: pending.queueMs ?? 0,
          };
          pending.resolve(result);
        }
      }
      this.pendingValidations.delete(response.requestId);
      this.validationCacheKeys.delete(response.requestId);
      if (this.activeCandidateRequestId === response.requestId) {
        this.activeCandidateRequestId = undefined;
        this.dispatchQueuedCandidate();
      }
      return;
    }
    if (response.type === 'export') {
      const pending = this.pendingExports.get(response.requestId);
      pending?.resolve({
        filename: response.filename,
        mimeType: response.mimeType,
        data: response.data,
      });
      this.pendingExports.delete(response.requestId);
      return;
    }
    const error = new GeometryOperationError(
      response.failure ?? failureFrom({ code: 'geometry-build-failed', message: response.message }),
      response.diagnostics ?? { stage: 'generation', type: 'operation_error' },
    );
    const geometry = this.pendingGeometry.get(response.requestId);
    geometry?.reject(error);
    this.pendingGeometry.delete(response.requestId);
    const exportRequest = this.pendingExports.get(response.requestId);
    exportRequest?.reject(error);
    this.pendingExports.delete(response.requestId);
    const validation = this.pendingValidations.get(response.requestId);
    validation?.reject(error);
    this.pendingValidations.delete(response.requestId);
    this.validationCacheKeys.delete(response.requestId);
    if (this.activeCandidateRequestId === response.requestId) {
      this.activeCandidateRequestId = undefined;
      this.dispatchQueuedCandidate();
    }
    if (this.activePreviewRequestId === response.requestId) {
      this.activePreviewRequestId = undefined;
      const latest = this.queuedPreview;
      this.queuedPreview = undefined;
      if (latest)
        this.sendGenerate(
          latest.params,
          latest.fontDefinition,
          latest.requestId,
          latest.subtitleFontDefinition,
          latest.cacheKey,
        );
    }
  }

  private readonly previewCacheKeys = new Map<number, string>();
  private readonly validationCacheKeys = new Map<number, string>();

  private cacheKey(
    operation: 'preview' | 'validation',
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): string {
    return `${operation}|${stableStringify(params)}|${fontKey(fontDefinition)}|${fontKey(subtitleFontDefinition)}`;
  }

  private currentError(): Error {
    return this.disposed ? disposedError() : failedError();
  }

  private handleWorkerFailure(worker: Worker, error: Error): void {
    if (this.disposed || this.workerFailed || worker !== this.worker) return;
    this.workerFailed = true;
    for (const pending of this.pendingGeometry.values()) pending.reject(error);
    for (const pending of this.pendingExports.values()) pending.reject(error);
    for (const pending of this.pendingValidations.values()) pending.reject(error);
    this.pendingGeometry.clear();
    this.pendingExports.clear();
    this.pendingValidations.clear();
    this.clearRequestTimers();
    this.previewCacheKeys.clear();
    this.validationCacheKeys.clear();
    this.queuedPreview = undefined;
    this.activePreviewRequestId = undefined;
    this.rejectQueuedCandidate(error);
    this.activeCandidateRequestId = undefined;
    worker.terminate();
    if (!this.recoveryAvailable) return;
    this.recoveryAvailable = false;
    this.replaceWorker();
  }

  private replaceWorker(): void {
    let replacement: Worker | undefined;
    try {
      replacement = this.createWorker();
      this.worker = replacement;
      this.workerFailed = false;
      replacement.postMessage({ type: 'warmup' } satisfies WorkerRequest);
    } catch {
      replacement?.terminate();
      this.workerFailed = true;
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleResponse(worker, event.data);
    worker.onerror = () => this.handleWorkerFailure(worker, failedError('worker_error'));
    worker.onmessageerror = () => this.handleWorkerFailure(worker, failedError('message_error'));
    return worker;
  }

  private startRequestTimer(requestId: number, worker: Worker): void {
    this.clearRequestTimer(requestId);
    this.requestTimers.set(
      requestId,
      setTimeout(() => {
        this.requestTimers.delete(requestId);
        this.handleWorkerFailure(worker, new GeometryRequestTimeoutError());
      }, this.requestTimeoutMs),
    );
  }

  private clearRequestTimer(requestId: number): void {
    const timer = this.requestTimers.get(requestId);
    if (timer !== undefined) clearTimeout(timer);
    this.requestTimers.delete(requestId);
  }

  private clearRequestTimers(): void {
    for (const timer of this.requestTimers.values()) clearTimeout(timer);
    this.requestTimers.clear();
  }

  private fontForWorker(fontDefinition: FontDefinition | undefined): FontDefinition | undefined {
    return fontDefinition;
  }

  private cloneCachedResult(
    cached: GeometryResult,
    generationId: number,
    lookupStartedAt = performance.now(),
    queueMs = 0,
  ): GeometryResult {
    const lookupMs = performance.now() - lookupStartedAt;
    const cloneStartedAt = performance.now();
    const result = cloneResult(cached, generationId);
    const cloneMs = performance.now() - cloneStartedAt;
    const timings = Object.fromEntries(
      Object.entries(result.timings ?? {}).filter(([key]) => !key.endsWith('Ms')),
    );
    result.timings = {
      ...timings,
      clientCacheHit: 1,
      clientCacheLookupMs: lookupMs,
      clientCacheCloneMs: cloneMs,
      clientRoundTripMs: lookupMs + cloneMs + queueMs,
      clientQueueMs: queueMs,
    };
    return result;
  }

  private supersedeCandidate(requestId: number): void {
    const pending = this.pendingValidations.get(requestId);
    pending?.reject(new GeometryCandidateSupersededError());
    this.pendingValidations.delete(requestId);
    this.validationCacheKeys.delete(requestId);
  }

  private rejectQueuedCandidate(error: Error): void {
    if (!this.queuedCandidate) return;
    this.supersedeCandidateWithError(this.queuedCandidate.requestId, error);
    this.queuedCandidate = undefined;
  }

  private supersedeCandidateWithError(requestId: number, error: Error): void {
    const pending = this.pendingValidations.get(requestId);
    pending?.reject(error);
    this.pendingValidations.delete(requestId);
    this.validationCacheKeys.delete(requestId);
  }

  private dispatchQueuedCandidate(): void {
    const queued = this.queuedCandidate;
    this.queuedCandidate = undefined;
    if (!queued || this.disposed || this.workerFailed) return;
    if (queued.cacheKey && this.validationCacheKeys.has(queued.requestId)) {
      const cached = this.resultCache.get(queued.cacheKey);
      if (cached) {
        const pending = this.pendingValidations.get(queued.requestId);
        const queueMs = pending ? Math.max(0, performance.now() - pending.startedAt) : 0;
        this.pendingValidations
          .get(queued.requestId)
          ?.resolve(this.cloneCachedResult(cached, queued.requestId, performance.now(), queueMs));
        this.pendingValidations.delete(queued.requestId);
        this.validationCacheKeys.delete(queued.requestId);
        return;
      }
    }
    this.activeCandidateRequestId = queued.requestId;
    this.sendValidate(
      queued.params,
      queued.fontDefinition,
      queued.subtitleFontDefinition,
      queued.requestId,
      true,
    );
  }
}
