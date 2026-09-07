import { buildKeychain, createWasm } from '../../domain/keychain/build/keychain-builder';
import {
  sanitizeFilename,
  applyPrintAppearanceOverrides,
  type ExportFormat,
  type WorkerRequest,
  type WorkerResponse,
} from '../../domain/keychain/model/types';
import { serializeBinaryStl } from '../export/stl-serializer';
import { serializeThreeMf } from '../export/three-mf-serializer';
import { BoundedResultCache } from './result-cache';
let wasmPromise: ReturnType<typeof createWasm> | undefined;
const localFonts = new Map<string, Parameters<typeof buildKeychain>[3]>();
type BuiltGeometry = Awaited<ReturnType<typeof buildKeychain>>;
const builtGeometryWeight = (built: BuiltGeometry): number => {
  const buffers = new Set<ArrayBufferLike>();
  const meshes = [
    built.result.baseMesh,
    built.result.reliefMesh,
    ...(built.result.parts ?? []).map((part) => part.mesh),
    ...(built.exportMesh ? [built.exportMesh] : []),
  ];
  for (const mesh of meshes) {
    buffers.add(mesh.positions.buffer);
    buffers.add(mesh.indices.buffer);
  }
  let total = 0;
  for (const buffer of buffers) total += buffer.byteLength;
  return total;
};
const finalCache = new BoundedResultCache<BuiltGeometry>(8, 64 * 1024 * 1024, builtGeometryWeight);
const getWasm = () => {
  wasmPromise ??= createWasm();
  return wasmPromise;
};
const fontForBuild = (definition: Parameters<typeof buildKeychain>[3]) => {
  if (definition?.source !== 'local') return definition;
  if (definition.data) {
    localFonts.set(definition.id, definition);
    return definition;
  }
  return localFonts.get(definition.id) ?? definition;
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
const fontKey = async (font: Parameters<typeof buildKeychain>[3]): Promise<string> => {
  if (!font) return '-';
  const byteIdentity = font.data
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', font.data)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
    : '';
  const metadata = Object.fromEntries(Object.entries(font).filter(([key]) => key !== 'data'));
  return stableStringify({ ...metadata, byteDigest: byteIdentity });
};
const cacheKey = async (
  quality: 'exportable' | 'validation',
  request: Extract<WorkerRequest, { type: 'generate' | 'validate' | 'export' }>,
): Promise<string> =>
  Promise.all([
    fontKey(fontForBuild(request.fontDefinition)),
    fontKey(fontForBuild(request.subtitleFontDefinition)),
  ]).then(
    ([primaryFontKey, subtitleFontKey]) =>
      `${quality}|${stableStringify(request.params)}|${primaryFontKey}|${subtitleFontKey}`,
  );
const responseResult = (result: BuiltGeometry['result']) => ({
  ...structuredClone(result),
});
const transferBuffers = (result: BuiltGeometry['result']): ArrayBuffer[] => {
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
  return [...buffers].filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
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
    if (request.type === 'generate' || request.type === 'validate') {
      const startedAt = performance.now();
      const key = await cacheKey('exportable', request);
      const cached = finalCache.get(key);
      const cacheHit = cached !== undefined;
      const built =
        cached ??
        (await buildKeychain(
          wasm,
          request.params,
          true,
          fontForBuild(request.fontDefinition),
          request.subtitleFontDefinition ? fontForBuild(request.subtitleFontDefinition) : undefined,
        ));
      if (!cacheHit) {
        built.result.timings = {
          ...built.result.timings,
          workerComputeMs: performance.now() - startedAt,
        };
        finalCache.set(key, built);
      }
      const { result } = built;
      const output = responseResult(result);
      if (cacheHit) {
        output.timings = {
          ...output.timings,
          workerCacheLookupMs: performance.now() - startedAt,
        };
      }
      if (request.type === 'validate') {
        const response: WorkerResponse = {
          type: 'validation',
          requestId: request.requestId,
          result: output,
        };
        self.postMessage(response, {
          transfer: [...transferBuffers(output)],
        });
        return;
      }
      const response: WorkerResponse = {
        type: 'geometry',
        requestId: request.requestId,
        result: output,
      };
      self.postMessage(response, {
        transfer: [...transferBuffers(output)],
      });
    } else {
      const key = await cacheKey('exportable', request);
      const cached = finalCache.get(key);
      const cacheHit = cached !== undefined;
      const built =
        cached ??
        (await buildKeychain(
          wasm,
          request.params,
          true,
          fontForBuild(request.fontDefinition),
          request.subtitleFontDefinition ? fontForBuild(request.subtitleFontDefinition) : undefined,
        ));
      const { result, exportMesh } = built;
      const blockingIssues = result.issues.filter((issue) => issue.severity === 'error');
      const disconnectedOnly =
        blockingIssues.length > 0 && blockingIssues.every((issue) => issue.code === 'disconnected');
      if (!exportMesh || (!result.printable && !(request.allowDisconnected && disconnectedOnly))) {
        const message =
          result.issues.find((issue) => issue.severity === 'error')?.message ??
          'This model is not ready to download.';
        const response: WorkerResponse = { type: 'error', requestId: request.requestId, message };
        self.postMessage(response);
        return;
      }
      if (!cacheHit) finalCache.set(key, built);
      const appearance = applyPrintAppearanceOverrides(
        result.appearance,
        request.appearanceOverrides,
      );
      const format: ExportFormat = request.format ?? 'stl';
      const data =
        format === '3mf'
          ? serializeThreeMf(
              result.baseMesh,
              result.reliefMesh,
              exportMesh,
              request.mode ?? 'separate-colors',
              appearance,
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
