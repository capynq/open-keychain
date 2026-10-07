import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';

import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import {
  DEFAULT_PARAMS,
  type MeshBuffer,
  type TemplateId,
} from '../src/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '../src/domain/keychain/templates/template-builder';
import { serializeBinaryStl } from '../src/infrastructure/export/stl-serializer';
import { serializeThreeMf } from '../src/infrastructure/export/three-mf-serializer';
import { listMatrixCases, type MatrixCase } from './bench-matrix-cases';

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

const templateById = new Map(TEMPLATE_CATALOG.map((template) => [template.id, template]));

const finiteMesh = (mesh: MeshBuffer): boolean => {
  if (!mesh.positions.length || mesh.indices.length % 3 !== 0) return false;
  for (let index = 0; index < mesh.positions.length; index += 1)
    if (!Number.isFinite(mesh.positions[index])) return false;
  for (let index = 0; index < mesh.indices.length; index += 1)
    if (mesh.indices[index] >= mesh.positions.length / 3) return false;
  return true;
};

const validateStl = (mesh: MeshBuffer): string | undefined => {
  const data = serializeBinaryStl(mesh);
  const triangleCount = new DataView(data).getUint32(80, true);
  const expectedBytes = 84 + triangleCount * 50;
  if (data.byteLength !== expectedBytes) return 'invalid-stl-length';
  if (triangleCount !== mesh.indices.length / 3) return 'invalid-stl-triangle-count';
  return undefined;
};

type PhaseDurations = {
  buildKeychainMs: number;
  meshValidationMs: number;
  stlMs: number;
  threeMfMs: number;
};

const validateThreeMf = (
  baseMesh: MeshBuffer,
  reliefMesh: MeshBuffer,
  exportMesh: MeshBuffer,
  result: Awaited<ReturnType<typeof buildKeychain>>['result'],
  mode: 'separate-colors' | 'merged',
): string | undefined => {
  const archive = unzipSync(
    new Uint8Array(serializeThreeMf(baseMesh, reliefMesh, exportMesh, mode, result.appearance)),
  );
  const modelFile = archive['3D/3dmodel.model'];
  if (!modelFile) return 'missing-3mf-model';
  const model = strFromU8(modelFile);
  if (!model.includes('unit="millimeter"')) return 'invalid-3mf-units';
  if (
    !model.includes('name="Open Keychain"') &&
    !model.includes('<metadata name="Title">Open Keychain</metadata>')
  )
    return 'missing-3mf-title';
  const expectedColors =
    mode === 'merged'
      ? [result.appearance.base.color]
      : [result.appearance.base.color, result.appearance.relief.color];
  if (!expectedColors.every((color) => model.includes(`displaycolor="${color}"`)))
    return 'missing-3mf-color';
  const items = model.match(/<item objectid=/g)?.length ?? 0;
  const objects = model.match(/<object id=/g)?.length ?? 0;
  const meshes = model.match(/<mesh>/g)?.length ?? 0;
  if (mode === 'merged' && (items !== 1 || objects !== 1 || meshes !== 1))
    return 'invalid-3mf-merged-layout';
  if (mode === 'separate-colors' && (items !== 1 || objects !== 1 || meshes !== 1))
    return 'invalid-3mf-separate-layout';
  return undefined;
};

const issueCodes = (result: Awaited<ReturnType<typeof buildKeychain>>['result']): string[] => {
  return result.issues.map((issue) => issue.code);
};

const caseLabel = (item: MatrixCase): string => item.id;

type CaseResult = {
  id: string;
  templateId: string;
  category: 'passed' | 'expectedInvalid' | 'failed';
  warnings: string[];
  phaseDurationsMs: PhaseDurations;
  failure?: { reason: string; issues: string[] };
};

const validateCase = async (
  wasm: Awaited<ReturnType<typeof createWasm>>,
  item: MatrixCase,
): Promise<CaseResult> => {
  const template = templateById.get(item.templateId);
  if (!template) throw new Error(`Unknown matrix template ${item.templateId}`);
  const buildStarted = performance.now();
  const { result, exportMesh } = await buildKeychain(
    wasm,
    {
      ...DEFAULT_PARAMS,
      templateId: item.templateId,
      styleId: item.styleId,
      fontId: item.fontId,
      text: item.text.value,
      baseThicknessMm:
        item.templateId === 'articulated-name'
          ? 3.4
          : item.templateId === 'magnet'
            ? 4.4
            : DEFAULT_PARAMS.baseThicknessMm,
    },
    true,
  );
  const buildKeychainMs = performance.now() - buildStarted;
  const codes = issueCodes(result);
  const profileReason =
    !result.constraints || !result.printProfile
      ? 'missing-print-profile'
      : result.printProfile.constraints.minimumWallMm !== result.constraints.minimumWallMm ||
          result.printProfile.constraints.minimumClearanceMm !==
            result.constraints.minimumClearanceMm ||
          result.printProfile.constraints.maximumWidthMm !== result.constraints.maximumWidthMm
        ? 'print-profile-mismatch'
        : !Number.isFinite(result.constraints.minimumWallMm) ||
            result.constraints.minimumWallMm <= 0
          ? 'invalid-print-constraints'
          : undefined;
  const expectedInvalid =
    (codes.length === 1 && codes[0] === 'text-too-wide') ||
    (item.templateId === 'articulated-name' &&
      item.text.className === 'short' &&
      codes.length === 1 &&
      codes[0] === 'articulated-shell-count');
  const phaseDurationsMs: PhaseDurations = {
    buildKeychainMs,
    meshValidationMs: 0,
    stlMs: 0,
    threeMfMs: 0,
  };
  let exportReason = 'missing-export-mesh';
  if (exportMesh) {
    const stlStarted = performance.now();
    const stlReason = validateStl(exportMesh);
    phaseDurationsMs.stlMs = performance.now() - stlStarted;
    let threeMfReason: string | undefined;
    if (!stlReason) {
      const threeMfStarted = performance.now();
      threeMfReason =
        validateThreeMf(
          result.baseMesh,
          result.reliefMesh,
          exportMesh,
          result,
          'separate-colors',
        ) ?? validateThreeMf(result.baseMesh, result.reliefMesh, exportMesh, result, 'merged');
      phaseDurationsMs.threeMfMs = performance.now() - threeMfStarted;
    }
    exportReason = stlReason ?? threeMfReason ?? '';
  }
  const reason = !result.printable
    ? expectedInvalid
      ? undefined
      : 'not-printable'
    : result.issues.some((issue) => issue.severity === 'error')
      ? 'error-issue'
      : !codes.includes('text-over-width') && result.dimensions.widthMm > 120.1
        ? 'over-width'
        : (() => {
              const meshValidationStarted = performance.now();
              const invalidMesh =
                !finiteMesh(result.baseMesh) ||
                !finiteMesh(result.reliefMesh) ||
                !exportMesh ||
                !finiteMesh(exportMesh);
              phaseDurationsMs.meshValidationMs = performance.now() - meshValidationStarted;
              return invalidMesh;
            })()
          ? 'invalid-mesh'
          : (profileReason ?? exportReason);
  return {
    id: item.id,
    templateId: item.templateId,
    category: reason ? 'failed' : expectedInvalid ? 'expectedInvalid' : 'passed',
    warnings: codes,
    phaseDurationsMs,
    ...(reason ? { failure: { reason, issues: codes } } : {}),
  };
};

const emitWorkerEvent = (event: Record<string, unknown>) =>
  process.stdout.write(`${JSON.stringify(event)}\n`);
const wasmStarted = performance.now();
const wasm = await createWasm();
const wasmInitializationMs = performance.now() - wasmStarted;
if (process.env.MATRIX_WORKER === '1') {
  emitWorkerEvent({
    type: 'worker-ready',
    wasmInitializationMs,
    workerId: process.env.MATRIX_WORKER_ID,
  });
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line) continue;
    const packageData = JSON.parse(line) as { packageId: number; cases: MatrixCase[] };
    const packageCpuStart = process.cpuUsage();
    for (const item of packageData.cases) {
      const caseStarted = performance.now();
      const caseCpuStart = process.cpuUsage();
      emitWorkerEvent({
        type: 'case-started',
        id: item.id,
        name: caseLabel(item),
        workerId: process.env.MATRIX_WORKER_ID,
      });
      try {
        const result = await validateCase(wasm, item);
        const cpu = process.cpuUsage(caseCpuStart);
        const memory = process.memoryUsage();
        emitWorkerEvent({
          type: 'case-completed',
          ...result,
          durationMs: Math.round(performance.now() - caseStarted),
          cpuUserMicros: cpu.user,
          cpuSystemMicros: cpu.system,
          rssBytes: memory.rss,
          heapUsedBytes: memory.heapUsed,
          externalBytes: memory.external,
          name: caseLabel(item),
          workerId: process.env.MATRIX_WORKER_ID,
        });
      } catch (error) {
        const cpu = process.cpuUsage(caseCpuStart);
        emitWorkerEvent({
          type: 'case-completed',
          id: item.id,
          templateId: item.templateId,
          category: 'failed',
          warnings: [],
          durationMs: Math.round(performance.now() - caseStarted),
          cpuUserMicros: cpu.user,
          cpuSystemMicros: cpu.system,
          failure: { reason: error instanceof Error ? error.message : String(error), issues: [] },
          name: caseLabel(item),
          workerId: process.env.MATRIX_WORKER_ID,
        });
      }
    }
    const packageCpu = process.cpuUsage(packageCpuStart);
    const memory = process.memoryUsage();
    const totalCpu = process.cpuUsage();
    emitWorkerEvent({
      type: 'package-completed',
      packageId: packageData.packageId,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      cpuUserMicros: totalCpu.user,
      cpuSystemMicros: totalCpu.system,
      packageCpuUserMicros: packageCpu.user,
      packageCpuSystemMicros: packageCpu.system,
    });
  }
  globalThis.fetch = originalFetch;
} else {
  const filter = process.env.MATRIX_TEMPLATE as TemplateId | undefined;
  const cases = listMatrixCases().filter((item) => !filter || item.templateId === filter);
  const summary = {
    cases: cases.length,
    passed: 0,
    expectedInvalid: 0,
    failed: 0,
    warnings: {} as Record<string, number>,
    byTemplate: {} as Record<
      string,
      { cases: number; passed: number; expectedInvalid: number; failed: number }
    >,
    failures: [] as Array<{ case: string; reason: string; issues: string[] }>,
    truncatedFailures: 0,
  };
  for (const item of cases) {
    const result = await validateCase(wasm, item);
    const templateSummary = (summary.byTemplate[item.templateId] ??= {
      cases: 0,
      passed: 0,
      expectedInvalid: 0,
      failed: 0,
    });
    templateSummary.cases += 1;
    templateSummary[result.category] += 1;
    summary[result.category] += 1;
    for (const code of result.warnings) summary.warnings[code] = (summary.warnings[code] ?? 0) + 1;
    if (result.failure) summary.failures.push({ case: result.id, ...result.failure });
  }
  summary.truncatedFailures = Math.max(0, summary.failures.length - 20);
  summary.failures = summary.failures.slice(0, 20);
  console.log(JSON.stringify(summary));
  if (summary.failed) process.exitCode = 1;
  globalThis.fetch = originalFetch;
}
