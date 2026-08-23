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
import type { FontDefinition } from '../../domain/keychain/fonts/catalog';
export class GeometryClient {
  private readonly worker: Worker;
  private nextRequestId = 1;
  private readonly registeredLocalFonts = new WeakSet<FontDefinition>();
  private activePreviewRequestId: number | undefined;
  private queuedPreview:
    | {
        params: KeychainParams;
        fontDefinition?: FontDefinition;
        subtitleFontDefinition?: FontDefinition;
        requestId: number;
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
  constructor() {
    this.worker = new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleResponse(event.data);
    this.worker.postMessage({ type: 'warmup' } satisfies WorkerRequest);
  }
  request(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<GeometryResult> {
    const requestId = this.nextRequestId++;
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
      this.queuedPreview = { params, fontDefinition, requestId, subtitleFontDefinition };
      return promise;
    }
    this.sendGenerate(params, fontDefinition, requestId, subtitleFontDefinition);
    return promise;
  }
  export(
    params: KeychainParams,
    format: ExportFormat = 'stl',
    mode: ThreeMfMode = 'separate-colors',
    fontDefinition?: FontDefinition,
    appearanceOverrides?: PrintAppearanceOverrides,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<{
    filename: string;
    mimeType: string;
    data: ArrayBuffer;
  }> {
    const requestId = this.nextRequestId++;
    const promise = new Promise<{
      filename: string;
      mimeType: string;
      data: ArrayBuffer;
    }>((resolve, reject) => {
      this.pendingExports.set(requestId, { resolve, reject });
    });
    this.worker.postMessage({
      type: 'export',
      requestId,
      params,
      format,
      mode,
      appearanceOverrides,
      fontDefinition: this.fontForWorker(fontDefinition),
      subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
    } satisfies WorkerRequest);
    return promise;
  }
  /** Validate a candidate independently of the coalesced preview request. */
  validate(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    subtitleFontDefinition?: FontDefinition,
  ): Promise<GeometryResult> {
    const requestId = this.nextRequestId++;
    const promise = new Promise<GeometryResult>((resolve, reject) => {
      this.pendingValidations.set(requestId, { resolve, reject });
    });
    this.worker.postMessage({
      type: 'validate',
      requestId,
      params,
      fontDefinition: this.fontForWorker(fontDefinition),
      subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
    } satisfies WorkerRequest);
    return promise;
  }
  dispose(): void {
    this.disposed = true;
    const error = new Error('Geometry client disposed.');
    for (const pending of this.pendingGeometry.values()) pending.reject(error);
    for (const pending of this.pendingExports.values()) pending.reject(error);
    for (const pending of this.pendingValidations.values()) pending.reject(error);
    this.pendingGeometry.clear();
    this.pendingExports.clear();
    this.pendingValidations.clear();
    this.worker.terminate();
  }
  private sendGenerate(
    params: KeychainParams,
    fontDefinition?: FontDefinition,
    requestId = this.nextRequestId++,
    subtitleFontDefinition?: FontDefinition,
  ): void {
    this.activePreviewRequestId = requestId;
    this.worker.postMessage({
      type: 'generate',
      requestId,
      params,
      fontDefinition: this.fontForWorker(fontDefinition),
      subtitleFontDefinition: this.fontForWorker(subtitleFontDefinition),
    } satisfies WorkerRequest);
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
          pending.resolve(result);
        }
        this.pendingGeometry.delete(response.requestId);
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
        else pending.resolve(result);
      }
      this.pendingValidations.delete(response.requestId);
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
        );
    }
  }

  private fontForWorker(fontDefinition: FontDefinition | undefined): FontDefinition | undefined {
    if (
      !fontDefinition ||
      fontDefinition.source !== 'local' ||
      !fontDefinition.data ||
      !this.registeredLocalFonts.has(fontDefinition)
    ) {
      if (fontDefinition?.source === 'local' && fontDefinition.data)
        this.registeredLocalFonts.add(fontDefinition);
      return fontDefinition;
    }
    return { ...fontDefinition, data: undefined };
  }
}
