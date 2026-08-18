import { buildKeychain, createWasm } from '../../domain/keychain/build/keychain-builder';
import { serializeBinaryStl } from '../export/stl-serializer';
import { serializeThreeMf } from '../export/three-mf-serializer';
import {
  sanitizeFilename,
  type ExportFormat,
  type WorkerRequest,
  type WorkerResponse,
} from '../../domain/keychain/model/types';
let wasmPromise: ReturnType<typeof createWasm> | undefined;
const getWasm = () => {
  wasmPromise ??= createWasm();
  return wasmPromise;
};
void getWasm();
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'warmup') {
      await getWasm();
      return;
    }
    const wasm = await getWasm();
    if (request.type === 'generate') {
      const { result } = await buildKeychain(wasm, request.params);
      const response: WorkerResponse = { type: 'geometry', requestId: request.requestId, result };
      self.postMessage(response, {
        transfer: [
          result.baseMesh.positions.buffer,
          result.baseMesh.indices.buffer,
          result.reliefMesh.positions.buffer,
          result.reliefMesh.indices.buffer,
        ],
      });
    } else {
      const { result, exportMesh } = await buildKeychain(wasm, request.params, true);
      if (!exportMesh || !result.printable) {
        const message =
          result.issues.find((issue) => issue.severity === 'error')?.message ??
          'This model is not ready to download.';
        const response: WorkerResponse = { type: 'error', requestId: request.requestId, message };
        self.postMessage(response);
        return;
      }
      const format: ExportFormat = request.format ?? 'stl';
      const data =
        format === '3mf'
          ? serializeThreeMf(
              result.baseMesh,
              result.reliefMesh,
              exportMesh,
              request.mode ?? 'separate-colors',
              result.appearance,
            )
          : serializeBinaryStl(exportMesh);
      const filename = sanitizeFilename(request.params.text, request.params.styleId, format);
      const response: WorkerResponse = {
        type: 'export',
        requestId: request.requestId,
        filename,
        mimeType: format === '3mf' ? 'model/3mf' : 'model/stl',
        data,
      };
      self.postMessage(response, { transfer: [data] });
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      requestId: request.type === 'warmup' ? 0 : request.requestId,
      message:
        error instanceof Error ? error.message : 'The geometry engine could not create this model.',
    };
    self.postMessage(response);
  }
};
