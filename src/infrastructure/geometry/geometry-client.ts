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
import { BoundedResultCache } from './result-cache';

const disposedError = () => new Error('Geometry client disposed.');
const failedError = () => new Error('Geometry worker failed.');

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
  private readonly worker: Worker;
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
    { resolve: (result: GeometryResult) => void; reject: (error: Error) => void }
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
    { resolve: (result: GeometryResult) => void; reject: (error: Error) => void }
  >();
  private disposed = false;
  private workerFailed = false;
  private readonly resultCache = new BoundedResultCache<GeometryResult>(
    8,
    64 * 1024 * 1024,
    geometryResultWeight,
  );
  constructor() {
    this.worker = new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleResponse(event.data);
    this.worker.onerror = () => this.handleWorkerFailure(failedError());
    this.worker.onmessageerror = () => this.handleWorkerFailure(failedError());
    try {
      this.worker.postMessage({ type: 'warmup' } satisfies WorkerRequest);
    } catch (error) {
      this.handleWorkerFailure(error instanceof Error ? error : failedError());
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
    if (cached) return Promise.resolve(cloneResult(cached, requestId));
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingGeometry.set(requestId, { resolve, reject });
    });
    if (this.activePreviewRequestId !== undefined) {
      const stale = this.pendingGeometry.get(this.activePreviewRequestId);
      stale?.reject(new Error('Preview generation superseded.'));
      this.pendingGeometry.delete(this.activePreviewRequestId);
      if (this.queuedPreview) {
        const superseded = this.pendingGeometry.get(this.queuedPreview.requestId);
        superseded?.reject(new Error('Preview generation superseded.'));
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
    if (cached) return Promise.resolve(cloneResult(cached, requestId));
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingValidations.set(requestId, { resolve, reject });
    });
    if (cacheable) this.validationCacheKeys.set(requestId, cacheKey);
    try {
      this.worker.postMessage({
        type: 'validate',
        requestId,
        params,
        fontDefinition: this.fontForWorker(fontDefinition),
        subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
      } satisfies WorkerRequest);
    } catch (error) {
      this.pendingValidations.delete(requestId);
      this.validationCacheKeys.delete(requestId);
      return Promise.reject(error instanceof Error ? error : failedError());
    }
    return promise;
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
    this.queuedPreview = undefined;
    this.activePreviewRequestId = undefined;
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
    if (cacheKey) this.previewCacheKeys.set(requestId, cacheKey);
  }
  private handleResponse(response: WorkerResponse): void {
    if (this.disposed) return;
    if (response.type === 'geometry') {
      const pending = this.pendingGeometry.get(response.requestId);
      if (pending) {
        const result = { ...response.result, generationId: response.requestId };
        if (!validateGeometryResult(result)) {
          pending.reject(new Error('Geometry worker returned an invalid result.'));
        } else {
          const cacheKey = this.previewCacheKeys.get(response.requestId);
          if (cacheKey) this.resultCache.set(cacheKey, cloneResult(result, 0));
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
          pending.reject(new Error('Geometry worker returned an invalid validation result.'));
        else {
          const cacheKey = this.validationCacheKeys.get(response.requestId);
          if (cacheKey) this.resultCache.set(cacheKey, cloneResult(result, 0));
          pending.resolve(result);
        }
      }
      this.pendingValidations.delete(response.requestId);
      this.validationCacheKeys.delete(response.requestId);
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
    const error = new Error(response.message);
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

  private handleWorkerFailure(error: Error): void {
    if (this.disposed || this.workerFailed) return;
    this.workerFailed = true;
    for (const pending of this.pendingGeometry.values()) pending.reject(error);
    for (const pending of this.pendingExports.values()) pending.reject(error);
    for (const pending of this.pendingValidations.values()) pending.reject(error);
    this.pendingGeometry.clear();
    this.pendingExports.clear();
    this.pendingValidations.clear();
    this.previewCacheKeys.clear();
    this.validationCacheKeys.clear();
    this.queuedPreview = undefined;
    this.activePreviewRequestId = undefined;
  }

  private fontForWorker(fontDefinition: FontDefinition | undefined): FontDefinition | undefined {
    return fontDefinition;
  }
}
