import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildKeychain, createWasm } from '../../../src/domain/keychain/build/keychain-builder';
import { fontDefinition } from '../../../src/domain/keychain/fonts/catalog';
import { DEFAULT_PARAMS, type KeychainParams } from '../../../src/domain/keychain/model/types';

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  if (url.startsWith('/fonts/')) {
    const file = await fs.readFile(path.join(process.cwd(), 'public', url));
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return new Response(body);
  }
  return originalFetch(input);
}) as typeof fetch;

const repetitions = 7;
const contexts: Array<{ id: string; params: KeychainParams }> = [
  {
    id: 'name-keychain/contour/nunito',
    params: { ...DEFAULT_PARAMS, text: 'ALEX', fontId: 'nunito' },
  },
  {
    id: 'articulated-name/plain/rubik',
    params: {
      ...DEFAULT_PARAMS,
      templateId: 'articulated-name',
      styleId: 'plain',
      text: 'ALEX',
      fontId: 'rubik',
    },
  },
  {
    id: 'nameplate/contour/nunito',
    params: {
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      styleId: 'contour',
      text: 'ALEX',
      fontId: 'nunito',
    },
  },
];

type Quality = 'preview' | 'export';
const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const measure = async (
  wasm: Awaited<ReturnType<typeof createWasm>>,
  params: KeychainParams,
  includeExport: boolean,
): Promise<number> => {
  const startedAt = performance.now();
  await buildKeychain(wasm, params, includeExport, fontDefinition(params.fontId));
  return performance.now() - startedAt;
};

const wasmStartedAt = performance.now();
const wasm = await createWasm();
const wasmStartupMs = performance.now() - wasmStartedAt;
const results = [];

for (const [contextIndex, context] of contexts.entries()) {
  const coldOrder: Quality[] =
    contextIndex % 2 === 0 ? ['preview', 'export'] : ['export', 'preview'];
  const cold: Record<Quality, number> = {
    preview: 0,
    export: 0,
  };
  for (const quality of coldOrder)
    cold[quality] = await measure(wasm, context.params, quality === 'export');

  const warm: Record<Quality, number[]> = { preview: [], export: [] };
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const order: Quality[] = repetition % 2 === 0 ? ['preview', 'export'] : ['export', 'preview'];
    for (const quality of order)
      warm[quality].push(await measure(wasm, context.params, quality === 'export'));
  }
  results.push({
    id: context.id,
    cold: {
      order: coldOrder,
      previewMs: Number(cold.preview.toFixed(2)),
      exportMs: Number(cold.export.toFixed(2)),
    },
    warmMedianMs: {
      preview: Number(median(warm.preview).toFixed(2)),
      export: Number(median(warm.export).toFixed(2)),
    },
    warmSamplesMs: {
      preview: warm.preview.map((value) => Number(value.toFixed(2))),
      export: warm.export.map((value) => Number(value.toFixed(2))),
    },
  });
}

console.log(
  JSON.stringify(
    {
      schema: 'geometry-preview-startup-benchmark.v1',
      repetitions,
      wasmStartupMs: Number(wasmStartupMs.toFixed(2)),
      contexts: results,
      caveat:
        'Cold values are the first build per context in one process. The second member of each cold pair may benefit from warmed font/module state; compare cold order carefully. Warm values are paired alternating measurements, not browser input-to-render latency.',
    },
    null,
    2,
  ),
);
