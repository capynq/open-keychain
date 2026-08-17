import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';

type ManualValidation = {
  schemaVersion: number;
  release: string;
  slicerCases: Array<{
    id: string;
    fixtureId: string;
    slicer: string;
    slicerVersion: string;
    format: string;
    status: string;
    repairWarnings: string[];
    dimensionsMatch: boolean;
    objectLayoutCorrect: boolean;
    colorsPreserved: boolean | null;
    evidence: string[];
  }>;
  physicalPrints: Array<{
    id: string;
    fixtureId: string;
    printer: string;
    nozzleMm: number;
    format: string;
    slicer: string;
    slicerVersion: string;
    material: string;
    layerHeightMm: number;
    profile: string;
    status: string;
    inspectionPassed: boolean;
    multicolor: boolean;
    evidence: string[];
  }>;
};

type ValidationItem =
  ManualValidation['slicerCases'][number] | ManualValidation['physicalPrints'][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const assertManualValidation: (
  value: unknown,
  filename: string,
) => asserts value is ManualValidation = (value, filename) => {
  if (
    !isRecord(value) ||
    typeof value.schemaVersion !== 'number' ||
    typeof value.release !== 'string' ||
    !Array.isArray(value.slicerCases) ||
    !Array.isArray(value.physicalPrints)
  )
    throw new Error(`${filename} does not match the validation schema`);

  for (const item of value.slicerCases) {
    if (
      !isRecord(item) ||
      !['id', 'fixtureId', 'slicer', 'slicerVersion', 'format', 'status'].every(
        (field) => typeof item[field] === 'string',
      ) ||
      !isStringArray(item.repairWarnings) ||
      typeof item.dimensionsMatch !== 'boolean' ||
      typeof item.objectLayoutCorrect !== 'boolean' ||
      (typeof item.colorsPreserved !== 'boolean' && item.colorsPreserved !== null) ||
      !isStringArray(item.evidence)
    )
      throw new Error(`${filename} contains a malformed slicer case`);
  }

  for (const item of value.physicalPrints) {
    if (
      !isRecord(item) ||
      ![
        'id',
        'fixtureId',
        'printer',
        'format',
        'slicer',
        'slicerVersion',
        'material',
        'profile',
        'status',
      ].every((field) => typeof item[field] === 'string') ||
      typeof item.nozzleMm !== 'number' ||
      typeof item.layerHeightMm !== 'number' ||
      typeof item.inspectionPassed !== 'boolean' ||
      typeof item.multicolor !== 'boolean' ||
      !isStringArray(item.evidence)
    )
      throw new Error(`${filename} contains a malformed physical print case`);
  }
};

const duplicateIds = (items: Array<{ id: string }>): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
};

const requireExpectedIds = (
  label: string,
  actual: Array<{ id: string }>,
  expected: Array<{ id: string }>,
): void => {
  const duplicates = duplicateIds(actual);
  if (duplicates.length)
    throw new Error(`${label} contains duplicate IDs: ${duplicates.join(', ')}`);
  const actualIds = new Set(actual.map(({ id }) => id));
  const expectedIds = new Set(expected.map(({ id }) => id));
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const unexpected = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length || unexpected.length)
    throw new Error(
      `${label} IDs do not match the generated template; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`,
    );
};

const requireMatchingFields = (
  label: string,
  actual: ValidationItem[],
  expected: ValidationItem[],
  fields: string[],
): void => {
  const expectedById = new Map(expected.map((item) => [item.id, item]));
  for (const item of actual) {
    const expectedItem = expectedById.get(item.id);
    if (!expectedItem) continue;
    for (const field of fields) {
      const actualValue = (item as unknown as Record<string, unknown>)[field];
      const expectedValue = (expectedItem as unknown as Record<string, unknown>)[field];
      if (actualValue !== expectedValue)
        throw new Error(`${label} ${item.id} changes required field ${String(field)}`);
    }
  }
};

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as { version: string };
const release = `v${packageJson.version}`;
const root = path.resolve('artifacts', 'self-hosted-beta');
const sourceDir = path.join(root, release);
const manualPath = path.join(sourceDir, 'manual-validation.json');
const templatePath = path.join(sourceDir, 'manual-validation.template.json');
const gitStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (gitStatus) throw new Error('Release evidence packaging requires a clean Git worktree');

const manual: unknown = JSON.parse(await fs.readFile(manualPath, 'utf8'));
const template: unknown = JSON.parse(await fs.readFile(templatePath, 'utf8'));
assertManualValidation(manual, 'manual-validation.json');
assertManualValidation(template, 'manual-validation.template.json');
if (manual.schemaVersion !== 1 || manual.release !== release)
  throw new Error(`manual-validation.json must use schemaVersion 1 and release ${release}`);
if (template.schemaVersion !== 1 || template.release !== release)
  throw new Error(
    `manual-validation.template.json must use schemaVersion 1 and release ${release}`,
  );
requireExpectedIds('Slicer cases', manual.slicerCases, template.slicerCases);
requireExpectedIds('Physical print cases', manual.physicalPrints, template.physicalPrints);
requireMatchingFields('Slicer case', manual.slicerCases, template.slicerCases, [
  'fixtureId',
  'slicer',
  'format',
]);
requireMatchingFields('Physical print case', manual.physicalPrints, template.physicalPrints, [
  'fixtureId',
  'printer',
  'nozzleMm',
  'format',
  'slicer',
  'material',
  'layerHeightMm',
]);
if (
  manual.slicerCases.length !== 60 ||
  manual.slicerCases.some(
    (item) =>
      item.status !== 'pass' ||
      !item.slicerVersion.trim() ||
      item.repairWarnings.length > 0 ||
      item.dimensionsMatch !== true ||
      item.objectLayoutCorrect !== true ||
      (item.format !== 'stl' && item.colorsPreserved !== true),
  )
)
  throw new Error(
    'All 60 slicer cases must pass with a version, matching dimensions/layout, no repair warnings, and preserved 3MF colors',
  );
if (
  manual.physicalPrints.length !== 12 ||
  manual.physicalPrints.some(
    (item) =>
      item.status !== 'pass' ||
      item.inspectionPassed !== true ||
      !item.slicerVersion.trim() ||
      !item.profile.trim(),
  )
)
  throw new Error(
    'All 12 physical print cases must pass inspection and record slicer versions and profiles',
  );
if (
  manual.physicalPrints.some(
    (item) => item.format.startsWith('threeMf') && item.multicolor !== true,
  )
)
  throw new Error('Every physical 3MF print must be recorded as multicolor');

for (const item of [...manual.slicerCases, ...manual.physicalPrints]) {
  if (!Array.isArray(item.evidence) || item.evidence.length === 0)
    throw new Error(`Validation case ${item.id} requires at least one evidence file`);
}
const requiredEvidence = [...manual.slicerCases, ...manual.physicalPrints].flatMap((item) =>
  item.evidence.map((evidencePath) => ({ caseId: item.id, evidencePath })),
);
const realSourceDir = await fs.realpath(sourceDir);
for (const { caseId, evidencePath: relativePath } of requiredEvidence) {
  const absolutePath = path.resolve(sourceDir, relativePath);
  if (!absolutePath.startsWith(`${sourceDir}${path.sep}`))
    throw new Error(`Evidence path escapes the release directory: ${relativePath}`);
  try {
    const linkStats = await fs.lstat(absolutePath);
    if (linkStats.isSymbolicLink()) throw new Error('symbolic links are not accepted');
    const realEvidencePath = await fs.realpath(absolutePath);
    if (!realEvidencePath.startsWith(`${realSourceDir}${path.sep}`))
      throw new Error('evidence resolves outside the release directory');
    if (!(await fs.stat(realEvidencePath)).isFile()) throw new Error('evidence is not a file');
  } catch {
    throw new Error(`Evidence file for ${caseId} is invalid or missing: ${relativePath}`);
  }
}

const archiveFiles: Record<string, Uint8Array> = {};
const collect = async (directory: string): Promise<void> => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolutePath);
    else if (entry.isFile()) {
      const relativePath = path.relative(sourceDir, absolutePath).split(path.sep).join('/');
      archiveFiles[`${release}/${relativePath}`] = new Uint8Array(await fs.readFile(absolutePath));
    }
  }
};
await collect(sourceDir);
const outputPath = path.join(root, `open-keychain-${release}-validation-evidence.zip`);
await fs.writeFile(outputPath, zipSync(archiveFiles, { level: 9 }));
console.log(JSON.stringify({ outputPath, files: Object.keys(archiveFiles).length }));
