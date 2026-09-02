import { unzipSync, strFromU8 } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';

import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
} from '../src/domain/keychain/fonts/catalog';
import {
  DEFAULT_PARAMS,
  type KeychainParams,
  type MeshBuffer,
  type TemplateId,
} from '../src/domain/keychain/model/types';
import {
  TEMPLATE_CATALOG,
  type TemplateDefinition,
} from '../src/domain/keychain/templates/template-builder';
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

const texts = [
  { value: 'A', className: 'short' },
  { value: 'ALEX', className: 'standard-latin' },
  { value: 'MAXIMILIAN', className: 'long-latin' },
  { value: 'IIIIIIII', className: 'narrow-glyphs' },
  { value: 'WWWWWWWW', className: 'wide-glyphs' },
  { value: 'iJj', className: 'mixed-case' },
  { value: 'ÉMILIE', className: 'accented-latin' },
  { value: 'НИКИТА', className: 'standard-cyrillic' },
  { value: 'ВЛАДИСЛАВА', className: 'long-cyrillic' },
  { value: 'Привет', className: 'mixed-case-cyrillic' },
] as const;

type MatrixCase = {
  template: TemplateDefinition;
  styleId: KeychainParams['styleId'];
  fontId: string;
  text: (typeof texts)[number];
};

const matrixCases = (templateId?: TemplateId): MatrixCase[] => {
  const cases: MatrixCase[] = [];
  for (const template of TEMPLATE_CATALOG) {
    if (templateId && template.id !== templateId) continue;
    const styles = template.styles.length
      ? template.styles
      : (['contour'] as const satisfies readonly KeychainParams['styleId'][]);
    for (const font of FONT_CATALOG) {
      for (const text of texts) {
        const supported =
          template.id === 'articulated-name'
            ? fontSupportsArticulatedName(font, text.value)
            : fontSupportsText(font, text.value);
        if (!supported) continue;
        for (const styleId of styles) cases.push({ template, styleId, fontId: font.id, text });
      }
    }
  }
  return cases;
};

const finiteMesh = (mesh: MeshBuffer): boolean => {
  if (!mesh.positions.length || mesh.indices.length % 3 !== 0) return false;
  if (![...mesh.positions].every(Number.isFinite)) return false;
  return [...mesh.indices].every((index) => index < mesh.positions.length / 3);
};

const validateStl = (mesh: MeshBuffer): string | undefined => {
  const data = serializeBinaryStl(mesh);
  const triangleCount = new DataView(data).getUint32(80, true);
  const expectedBytes = 84 + triangleCount * 50;
  if (data.byteLength !== expectedBytes) return 'invalid-stl-length';
  if (triangleCount !== mesh.indices.length / 3) return 'invalid-stl-triangle-count';
  return undefined;
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
  const expectedColors = [result.appearance.base.color, result.appearance.relief.color].map(
    (color) => color.toUpperCase(),
  );
  if (!expectedColors.every((color) => model.includes(`displaycolor="${color}"`)))
    return 'missing-3mf-color';
  const items = model.match(/<item objectid=/g)?.length ?? 0;
  const objects = model.match(/<object id=/g)?.length ?? 0;
  if (mode === 'merged' && (items !== 1 || objects !== 3)) return 'invalid-3mf-merged-layout';
  if (mode === 'separate-colors' && (items !== 2 || objects !== 2))
    return 'invalid-3mf-separate-layout';
  return undefined;
};

const issueCodes = (result: Awaited<ReturnType<typeof buildKeychain>>['result']): string[] => {
  return result.issues.map((issue) => issue.code);
};

const caseLabel = (item: MatrixCase): string =>
  `${item.template.id}/${item.styleId}/${item.fontId}/${item.text.className}`;

const wasm = await createWasm();
const cases = matrixCases(process.env.MATRIX_TEMPLATE as TemplateId | undefined);
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
};
const failures: Array<{ case: string; reason: string; issues: string[] }> = [];

for (const item of cases) {
  const templateSummary = (summary.byTemplate[item.template.id] ??= {
    cases: 0,
    passed: 0,
    expectedInvalid: 0,
    failed: 0,
  });
  templateSummary.cases += 1;
  const { result, exportMesh } = await buildKeychain(
    wasm,
    {
      ...DEFAULT_PARAMS,
      templateId: item.template.id,
      styleId: item.styleId,
      fontId: item.fontId,
      text: item.text.value,
      baseThicknessMm:
        item.template.id === 'articulated-name'
          ? 3.4
          : item.template.id === 'magnet'
            ? 4.4
            : DEFAULT_PARAMS.baseThicknessMm,
    },
    true,
  );
  const codes = issueCodes(result);
  for (const code of codes) summary.warnings[code] = (summary.warnings[code] ?? 0) + 1;
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
  const widthAllowed = codes.includes('text-over-width');
  const expectedInvalid =
    (codes.length === 1 && codes[0] === 'text-too-wide') ||
    (item.template.id === 'articulated-name' &&
      item.text.className === 'short' &&
      codes.length === 1 &&
      codes[0] === 'articulated-shell-count');
  const exportReason = exportMesh
    ? (validateStl(exportMesh) ??
      validateThreeMf(result.baseMesh, result.reliefMesh, exportMesh, result, 'separate-colors') ??
      validateThreeMf(result.baseMesh, result.reliefMesh, exportMesh, result, 'merged'))
    : 'missing-export-mesh';
  const reason = !result.printable
    ? expectedInvalid
      ? undefined
      : 'not-printable'
    : result.issues.some((issue) => issue.severity === 'error')
      ? 'error-issue'
      : !widthAllowed && result.dimensions.widthMm > 120.1
        ? 'over-width'
        : !finiteMesh(result.baseMesh) ||
            !finiteMesh(result.reliefMesh) ||
            !exportMesh ||
            !finiteMesh(exportMesh)
          ? 'invalid-mesh'
          : (profileReason ?? exportReason);
  if (reason) {
    summary.failed += 1;
    templateSummary.failed += 1;
    failures.push({ case: caseLabel(item), reason, issues: codes });
  } else if (expectedInvalid) {
    summary.expectedInvalid += 1;
    templateSummary.expectedInvalid += 1;
  } else {
    summary.passed += 1;
    templateSummary.passed += 1;
  }
}

console.log(
  JSON.stringify({
    ...summary,
    failures: failures.slice(0, 20),
    truncatedFailures: Math.max(0, failures.length - 20),
  }),
);
if (summary.failed) process.exitCode = 1;
