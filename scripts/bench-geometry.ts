import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import { fontDefinition } from '../src/domain/keychain/fonts/catalog';
import {
  DEFAULT_PARAMS,
  type KeychainParams,
  type StyleId,
  type TemplateId,
} from '../src/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '../src/domain/keychain/templates/template-builder';
import { serializeBinaryStl } from '../src/infrastructure/export/stl-serializer';
import { serializeThreeMf } from '../src/infrastructure/export/three-mf-serializer';

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

const repetitionsArg = process.argv.find((arg) => arg.startsWith('--repetitions='));
const repetitions = Math.max(1, Number.parseInt(repetitionsArg?.split('=')[1] ?? '5', 10) || 5);
const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};
const stats = (values: number[]) => ({
  p50: Number(percentile(values, 0.5).toFixed(2)),
  p95: Number(percentile(values, 0.95).toFixed(2)),
});
const templateCombinations = TEMPLATE_CATALOG.flatMap((template) =>
  (template.styles.length > 0 ? template.styles : ['contour' as const]).map((styleId) => ({
    templateId: template.id,
    styleId,
  })),
);
const textFor = (templateId: TemplateId): string =>
  templateId === 'nameplate' ? 'NAMEPLATE' : templateId === 'magnet' ? 'MAGNET' : 'ALEX';
const paramsFor = (templateId: TemplateId, styleId: StyleId): KeychainParams => ({
  ...DEFAULT_PARAMS,
  templateId,
  styleId,
  text: textFor(templateId),
  fontId: templateId === 'articulated-name' ? 'rubik' : 'nunito',
});
const run = async (wasm: Awaited<ReturnType<typeof createWasm>>, params: KeychainParams) => {
  const startedAt = performance.now();
  const built = await buildKeychain(wasm, params, true, fontDefinition(params.fontId));
  if (built.exportMesh && built.result.printable) {
    serializeBinaryStl(built.exportMesh);
    serializeThreeMf(
      built.result.baseMesh,
      built.result.reliefMesh,
      built.exportMesh,
      'separate-colors',
      built.result.appearance,
    );
  }
  return {
    totalMs: performance.now() - startedAt,
    triangles: (built.result.baseMesh.indices.length + built.result.reliefMesh.indices.length) / 3,
    printable: built.result.printable,
    issueCodes: [...new Set(built.result.issues.map((issue) => issue.code))].sort(),
  };
};

const wasm = await createWasm();
const results = [];
for (const combination of templateCombinations) {
  const params = paramsFor(combination.templateId, combination.styleId);
  const cold = await run(wasm, params);
  const warm = [];
  for (let index = 0; index < repetitions; index += 1) warm.push(await run(wasm, params));
  results.push({
    ...combination,
    text: params.text,
    cold: {
      totalMs: Number(cold.totalMs.toFixed(2)),
      triangles: cold.triangles,
      printable: cold.printable,
      issueCodes: cold.issueCodes,
    },
    warm: {
      repetitions,
      totalMs: stats(warm.map((sample) => sample.totalMs)),
      triangles: stats(warm.map((sample) => sample.triangles)),
      printableRate: warm.filter((sample) => sample.printable).length / repetitions,
      issueCodes: [...new Set(warm.flatMap((sample) => sample.issueCodes))].sort(),
    },
  });
}

console.log(
  JSON.stringify(
    {
      schema: 'geometry-benchmark.v1',
      repetitions,
      combinations: results.length,
      workload: {
        includeExport: true,
        exports: ['stl', '3mf'],
        fontSource: 'bundled-local',
        coldDefinition:
          'First build of this combination in a shared process; WASM initialization is excluded and fonts may already be cached.',
      },
      results,
    },
    null,
    2,
  ),
);
