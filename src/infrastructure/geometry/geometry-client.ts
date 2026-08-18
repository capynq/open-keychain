import type {
  ExportFormat,
  GeometryResult,
  KeychainParams,
  ThreeMfMode,
  WorkerRequest,
  WorkerResponse,
} from '../../domain/keychain/model/types';
export class GeometryClient {
  private readonly worker: Worker;
  private nextRequestId = 1;
  private latestParams: KeychainParams | undefined;
  private busy = false;
  private resolveGeometry: ((result: GeometryResult) => void) | undefined;
  private rejectGeometry: ((error: Error) => void) | undefined;
  private resolveExport:
    ((file: { filename: string; mimeType: string; data: ArrayBuffer }) => void) | undefined;
  private rejectExport: ((error: Error) => void) | undefined;
  constructor() {
    this.worker = new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handleResponse(event.data);
    this.worker.postMessage({ type: 'warmup' } satisfies WorkerRequest);
  }
  request(params: KeychainParams): Promise<GeometryResult> {
    this.latestParams = params;
    if (this.busy && this.resolveGeometry) {
      return new Promise((resolve, reject) => {
        this.resolveGeometry = resolve;
        this.rejectGeometry = reject;
      });
    }
    return this.sendGenerate(params);
  }
  export(
    params: KeychainParams,
    format: ExportFormat = 'stl',
    mode: ThreeMfMode = 'separate-colors',
  ): Promise<{
    filename: string;
    mimeType: string;
    data: ArrayBuffer;
  }> {
    const requestId = this.nextRequestId++;
    this.resolveExport = undefined;
    this.rejectExport = undefined;
    this.worker.postMessage({
      type: 'export',
      requestId,
      params,
      format,
      mode,
    } satisfies WorkerRequest);
    return new Promise((resolve, reject) => {
      this.resolveExport = resolve;
      this.rejectExport = reject;
    });
  }
  dispose(): void {
    this.worker.terminate();
  }
  private sendGenerate(params: KeychainParams): Promise<GeometryResult> {
    const requestId = this.nextRequestId++;
    this.busy = true;
    this.worker.postMessage({ type: 'generate', requestId, params } satisfies WorkerRequest);
    return new Promise((resolve, reject) => {
      this.resolveGeometry = resolve;
      this.rejectGeometry = reject;
    });
  }
  private handleResponse(response: WorkerResponse): void {
    if (response.type === 'geometry') {
      this.busy = false;
      this.resolveGeometry?.({ ...response.result, generationId: response.requestId });
      this.resolveGeometry = undefined;
      this.rejectGeometry = undefined;
      const latest = this.latestParams;
      if (latest) {
        this.latestParams = undefined;
        this.sendGenerate(latest);
      }
      return;
    }
    if (response.type === 'export') {
      this.resolveExport?.({
        filename: response.filename,
        mimeType: response.mimeType,
        data: response.data,
      });
      this.resolveExport = undefined;
      this.rejectExport = undefined;
      return;
    }
    const error = new Error(response.message);
    this.rejectGeometry?.(error);
    this.rejectExport?.(error);
    this.resolveGeometry = undefined;
    this.rejectGeometry = undefined;
    this.resolveExport = undefined;
    this.rejectExport = undefined;
    this.busy = false;
  }
}
