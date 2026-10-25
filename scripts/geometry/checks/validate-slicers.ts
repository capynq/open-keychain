import { strFromU8, unzipSync } from 'fflate';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as { version: string };
const release = `v${packageJson.version}`;
const fixtureDir = path.resolve(
  process.env.KEYCHAIN_FIXTURE_DIR ?? path.join('artifacts', 'release', release),
);
const reportDir = path.join(fixtureDir, 'slicer-validation');
const compatibility = JSON.parse(await fs.readFile('docs/slicer-compatibility.json', 'utf8')) as {
  applications: Array<{ id: string; version: string | null; status: string }>;
  fixtureContract: { expectedCases: number; dimensionToleranceMm: number };
};
const manifest = JSON.parse(await fs.readFile(path.join(fixtureDir, 'manifest.json'), 'utf8')) as {
  cases: Array<{ id: string; files: Record<string, { filename: string }> }>;
};
if (manifest.cases.length !== compatibility.fixtureContract.expectedCases)
  throw new Error(
    `Expected ${compatibility.fixtureContract.expectedCases} generated fixtures, found ${manifest.cases.length}.`,
  );

const archiveCheck = async (filename: string, expectedMaterials: boolean): Promise<void> => {
  const file = path.join(fixtureDir, filename);
  let archive: ReturnType<typeof unzipSync>;
  try {
    archive = unzipSync(new Uint8Array(await fs.readFile(file)));
  } catch (error) {
    throw new Error(`Invalid 3MF ZIP archive ${filename}.`, { cause: error });
  }
  const model = archive['3D/3dmodel.model'];
  if (!model) throw new Error(`${filename} is missing 3D/3dmodel.model`);
  const xml = strFromU8(model);
  if (!xml.includes('unit="millimeter"') || (xml.match(/<item objectid=/g) ?? []).length !== 1)
    throw new Error(`${filename} does not contain one millimeter build item.`);
  if (expectedMaterials) {
    if (!xml.includes('<m:colorgroup') || (xml.match(/<m:color /g) ?? []).length !== 2)
      throw new Error(`${filename} is missing the separate-color material group.`);
    const group = [...xml.matchAll(/<m:colorgroup id="(\d+)"/g)][0]?.[1];
    if (!group || !new RegExp(`<triangle[^>]+pid="${group}"`).test(xml))
      throw new Error(`${filename} has no triangle reference to its color group.`);
    if (!new RegExp(`<triangle[^>]+pid="${group}"[^>]+p1="1"`).test(xml))
      throw new Error(`${filename} has no triangle assigned to the second color region.`);
    if (!archive['Metadata/Slic3r_PE_model.config'])
      throw new Error(`${filename} is missing named-volume metadata for PrusaSlicer.`);
  }
};

for (const item of manifest.cases) {
  await archiveCheck(item.files.threeMfSeparate.filename, true);
  await archiveCheck(item.files.threeMfMerged.filename, false);
}

const prusa = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/geometry/checks/validate-slicer.ts'],
  { encoding: 'utf8', env: process.env },
);
await fs.mkdir(reportDir, { recursive: true });
const pending = compatibility.applications.filter((application) => application.status !== 'pass');
const prusaStatus = prusa.error
  ? `failed: ${prusa.error.message}`
  : prusa.status === 0
    ? 'pass'
    : `failed: ${`${prusa.stdout}${prusa.stderr}`.trim() || `exit code ${prusa.status}`}`;
await fs.writeFile(
  path.join(reportDir, 'compatibility.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      fixtureCount: manifest.cases.length,
      dimensionToleranceMm: compatibility.fixtureContract.dimensionToleranceMm,
      structural3mfChecks: 'pass',
      prusaSlicerCli: prusaStatus,
      applications: compatibility.applications,
      pendingApplications: pending.map(({ id }) => id),
      completeCompatibilityMatrix: pending.length === 0,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    structural3mfChecks: 'pass',
    prusaSlicerCli: prusaStatus,
    pendingApplications: pending.map(({ id }) => id),
  }),
);
if (prusaStatus !== 'pass') process.exit(prusa.status ?? 1);
