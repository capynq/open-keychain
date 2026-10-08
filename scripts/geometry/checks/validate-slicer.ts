import { strFromU8, unzipSync } from 'fflate';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as { version: string };
const release = `v${packageJson.version}`;
const fixtureDir = path.resolve(
  process.env.KEYCHAIN_FIXTURE_DIR ?? path.join('artifacts', 'release', release),
);
const profilePath = path.resolve('tools/slicer/prusaslicer-minimal-fff.ini');
const outputDir = path.join(fixtureDir, 'slicer-validation');
const executable = process.env.PRUSASLICER_BIN || 'prusa-slicer';

const volumeBounds = (model: string, config: string): number[][] => {
  const vertices = [...model.matchAll(/<vertex x="([^"]*)" y="([^"]*)" z="([^"]*)"/g)].map(
    (match) => match.slice(1, 4).map(Number),
  );
  const triangles = [...model.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].map(
    (match) => match.slice(1, 4).map(Number),
  );
  return [...config.matchAll(/<volume firstid="(\d+)" lastid="(\d+)"/g)].map((range) => {
    const points = triangles
      .slice(Number(range[1]), Number(range[2]) + 1)
      .flatMap((triangle) => triangle.map((index) => vertices[index]));
    return [0, 1, 2].flatMap((axis) => [
      Math.min(...points.map((point) => point[axis])),
      Math.max(...points.map((point) => point[axis])),
    ]);
  });
};

const run = (subject: string, args: string[]): string => {
  const result = spawnSync(executable, args, { encoding: 'utf8' });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `PrusaSlicer was not found. Install PrusaSlicer or set PRUSASLICER_BIN, then rerun pnpm validate:slicer.`,
      );
    }
    throw result.error;
  }
  if (result.status !== 0 || result.signal)
    throw new Error(
      `PrusaSlicer failed for ${subject} (${result.signal ? `signal ${result.signal}` : `exit code ${result.status}`}): ${result.stderr || result.stdout}`,
    );
  return `${result.stdout}${result.stderr}`.trim();
};

await fs.access(profilePath);
try {
  await fs.access(fixtureDir);
} catch {
  throw new Error(`Fixtures are missing at ${fixtureDir}; run pnpm validation:fixtures first.`);
}

const version = run('the --help probe', ['--help'])
  .split(/\r?\n/)
  .find((line) => line.startsWith('PrusaSlicer-'));
if (!version) throw new Error('PrusaSlicer did not report its version.');
const manifest = JSON.parse(await fs.readFile(path.join(fixtureDir, 'manifest.json'), 'utf8')) as {
  cases?: Array<{ files?: Record<string, { filename?: string }> }>;
};
const files = (await fs.readdir(fixtureDir)).filter((file) => /\.(stl|3mf)$/i.test(file)).sort();
if (files.length === 0) throw new Error(`No STL/3MF fixtures found in ${fixtureDir}`);
const manifestFiles = new Set(
  (manifest.cases ?? []).flatMap((item) =>
    Object.values(item.files ?? {}).map((file) => file.filename),
  ),
);
for (const file of files)
  if (!manifestFiles.has(file)) throw new Error(`Fixture ${file} is not in manifest.json`);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const results: Array<{
  fixture: string;
  output: string;
  bytes: number;
  warnings: string[];
  colorVolumes?: { names: string[]; filamentAssignment: 'manual' };
}> = [];
for (const fixture of files) {
  const input = path.join(fixtureDir, fixture);
  const output = path.join(outputDir, `${fixture.slice(0, -4)}.gcode`);
  const slicerOutput = run(fixture, [
    '--load',
    profilePath,
    '--center',
    '110,110',
    '--export-gcode',
    input,
    '--output',
    output,
  ]);
  const warnings = slicerOutput
    .split(/\r?\n/)
    .filter((line) => /warn|repair|invalid|manifold|g-?code.*(?:conflict|path)/i.test(line));
  if (warnings.some((line) => /repair|invalid|manifold|g-?code.*(?:conflict|path)/i.test(line)))
    throw new Error(
      `PrusaSlicer reported a repair, invalid, manifold, or G-code path conflict for ${fixture}: ${warnings.join(' ')}`,
    );
  const stat = await fs.stat(output);
  if (stat.size === 0) throw new Error(`PrusaSlicer produced an empty output for ${fixture}`);
  let colorVolumes: { names: string[]; filamentAssignment: 'manual' } | undefined;
  if (fixture.endsWith('-separate.3mf')) {
    const archive = unzipSync(new Uint8Array(await fs.readFile(input)));
    const sourceConfig = strFromU8(archive['Metadata/Slic3r_PE_model.config']);
    const volumeNames = (xml: string): string[] =>
      [...xml.matchAll(/<metadata type="volume" key="name" value="([^"]*)"/g)].map(
        (match) => match[1],
      );
    const names = volumeNames(sourceConfig);
    const roundtrip = path.join(outputDir, `${fixture.slice(0, -4)}-roundtrip.3mf`);
    run(fixture, ['--export-3mf', input, '--output', roundtrip]);
    const imported = unzipSync(new Uint8Array(await fs.readFile(roundtrip)));
    const importedModel = strFromU8(imported['3D/3dmodel.model']);
    const importedConfig = strFromU8(imported['Metadata/Slic3r_PE_model.config']);
    const before = volumeBounds(strFromU8(archive['3D/3dmodel.model']), sourceConfig);
    const after = volumeBounds(importedModel, importedConfig);
    if (
      (importedModel.match(/<item objectid=/g) ?? []).length !== 1 ||
      names.length === 0 ||
      JSON.stringify(volumeNames(importedConfig)) !== JSON.stringify(names)
    )
      throw new Error(
        `PrusaSlicer changed the material volumes or color references for ${fixture}`,
      );
    if (
      before.length !== after.length ||
      before.some((bounds, index) =>
        bounds.some(
          (value, axis) =>
            !Number.isFinite(after[index][axis]) || Math.abs(value - after[index][axis]) > 0.01,
        ),
      )
    )
      throw new Error(`PrusaSlicer changed material volume alignment for ${fixture}`);
    if (
      [...importedConfig.matchAll(/<mesh\s+([^>]*)/g)].some((match) =>
        [
          ...match[1].matchAll(
            /(?:edges_fixed|degenerate_facets|facets_removed|facets_reversed|backwards_edges)="(\d+)"/g,
          ),
        ].some((repair) => Number(repair[1]) !== 0),
      )
    )
      throw new Error(`PrusaSlicer repaired a material volume in ${fixture}`);
    colorVolumes = { names, filamentAssignment: 'manual' };
  }
  results.push({
    fixture,
    output: path.relative(process.cwd(), output),
    bytes: stat.size,
    warnings,
    colorVolumes,
  });
}

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await fs.writeFile(
  path.join(outputDir, 'result.json'),
  `${JSON.stringify({ schemaVersion: 1, release, sourceCommit, profile: path.relative(process.cwd(), profilePath), slicer: version, results }, null, 2)}\n`,
);
console.log(JSON.stringify({ release, slicer: version, fixtures: results.length, outputDir }));
