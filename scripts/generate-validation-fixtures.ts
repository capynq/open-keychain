import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import { DEFAULT_PARAMS, type KeychainParams } from '../src/domain/keychain/model/types';
import { serializeBinaryStl } from '../src/infrastructure/export/stl-serializer';
import { serializeThreeMf } from '../src/infrastructure/export/three-mf-serializer';
import { VALIDATION_FIXTURES as fixtures } from './validation-fixtures';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as { version: string };
const release = `v${packageJson.version}`;
const outputDir = path.resolve('artifacts', 'self-hosted-beta', release);
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

const git = (args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourceCommit = git(['rev-parse', 'HEAD']);
const dirty = Boolean(git(['status', '--porcelain']));
const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');
const writeBinary = async (filename: string, data: ArrayBuffer) => {
  const bytes = new Uint8Array(data);
  await fs.writeFile(path.join(outputDir, filename), bytes);
  return { filename, bytes: bytes.byteLength, sha256: sha256(bytes) };
};

await fs.mkdir(outputDir, { recursive: true });
const wasm = await createWasm();
const cases = [];
for (const fixture of fixtures) {
  const params: KeychainParams = {
    ...DEFAULT_PARAMS,
    ...fixture.params,
    baseThicknessMm:
      fixture.params.templateId === 'articulated-name' ? 3.4 : DEFAULT_PARAMS.baseThicknessMm,
  };
  const { result, exportMesh } = await buildKeychain(wasm, params, true);
  if (!result.printable || !exportMesh)
    throw new Error(
      `${fixture.id} is not printable: ${result.issues.map((issue) => issue.code).join(', ')}`,
    );
  const files = {
    stl: await writeBinary(`${fixture.id}.stl`, serializeBinaryStl(exportMesh)),
    threeMfSeparate: await writeBinary(
      `${fixture.id}-separate.3mf`,
      serializeThreeMf(
        result.baseMesh,
        result.reliefMesh,
        exportMesh,
        'separate-colors',
        result.appearance,
      ),
    ),
    threeMfMerged: await writeBinary(
      `${fixture.id}-merged.3mf`,
      serializeThreeMf(result.baseMesh, result.reliefMesh, exportMesh, 'merged', result.appearance),
    ),
  };
  cases.push({
    id: fixture.id,
    params,
    dimensions: result.dimensions,
    issueCodes: result.issues.map((issue) => issue.code),
    appearance: result.appearance,
    files,
  });
}

const manifest = {
  schemaVersion: 1,
  release,
  sourceCommit,
  dirty,
  generatedAt: new Date().toISOString(),
  cases,
};
await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const slicers = ['PrusaSlicer', 'OrcaSlicer'];
const formats = ['stl', 'threeMfSeparate', 'threeMfMerged'];
const manualTemplate = {
  schemaVersion: 1,
  release,
  slicerCases: fixtures.flatMap((fixture) =>
    slicers.flatMap((slicer) =>
      formats.map((format) => ({
        id: `${fixture.id}/${slicer}/${format}`,
        fixtureId: fixture.id,
        slicer,
        slicerVersion: '',
        format,
        status: 'pending',
        repairWarnings: [],
        dimensionsMatch: false,
        objectLayoutCorrect: false,
        colorsPreserved: format === 'stl' ? null : false,
        evidence: [],
        notes: '',
      })),
    ),
  ),
  physicalPrints: [
    ['a1-04-contour', 'nk-contour-latin', 'Bambu A1 + AMS Lite', 0.4, 'threeMfSeparate'],
    ['a1-04-cyrillic', 'nk-capsule-cyrillic', 'Bambu A1 + AMS Lite', 0.4, 'threeMfMerged'],
    ['a1-04-articulated', 'art-latin', 'Bambu A1 + AMS Lite', 0.4, 'threeMfSeparate'],
    ['a1-04-nameplate', 'plate-long', 'Bambu A1 + AMS Lite', 0.4, 'threeMfMerged'],
    ['a1-04-plant', 'plant-latin', 'Bambu A1 + AMS Lite', 0.4, 'threeMfMerged'],
    ['a1-06-wide', 'nk-bubble-wide', 'Bambu A1 + AMS Lite', 0.6, 'threeMfSeparate'],
    ['a1-06-articulated', 'art-cyrillic', 'Bambu A1 + AMS Lite', 0.6, 'threeMfMerged'],
    ['ender-04-arch', 'nk-arch-descenders', 'Ender-3 V3 SE', 0.4, 'stl'],
    ['ender-04-articulated', 'art-latin', 'Ender-3 V3 SE', 0.4, 'stl'],
    ['ender-04-plant', 'plant-cyrillic', 'Ender-3 V3 SE', 0.4, 'stl'],
    ['ender-06-narrow', 'nk-soft-narrow', 'Ender-3 V3 SE', 0.6, 'stl'],
    ['ender-06-nameplate', 'plate-long', 'Ender-3 V3 SE', 0.6, 'stl'],
  ].map(([id, fixtureId, printer, nozzleMm, format]) => ({
    id,
    fixtureId,
    printer,
    nozzleMm,
    format,
    slicer: printer === 'Bambu A1 + AMS Lite' ? 'OrcaSlicer' : 'PrusaSlicer',
    slicerVersion: '',
    material: 'PLA',
    layerHeightMm: 0.2,
    profile: '',
    supportsUsed: null,
    multicolor: String(format).startsWith('threeMf'),
    status: 'pending',
    inspectionPassed: false,
    evidence: [],
    notes: '',
  })),
};
await fs.writeFile(
  path.join(outputDir, 'manual-validation.template.json'),
  `${JSON.stringify(manualTemplate, null, 2)}\n`,
);

console.log(
  JSON.stringify({ outputDir, release, cases: cases.length, files: cases.length * 3, dirty }),
);
