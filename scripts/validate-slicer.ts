import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as { version: string };
const release = `v${packageJson.version}`;
const fixtureDir = path.resolve('artifacts', 'self-hosted-beta', release);
const profilePath = path.resolve('tools/slicer/prusaslicer-minimal-fff.ini');
const outputDir = path.join(fixtureDir, 'slicer-validation');
const executable = process.env.PRUSASLICER_BIN || 'prusa-slicer';

const run = (args: string[]): string => {
  const result = spawnSync(executable, args, { encoding: 'utf8' });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `PrusaSlicer was not found. Install PrusaSlicer or set PRUSASLICER_BIN, then rerun pnpm validate:slicer.`,
      );
    }
    throw result.error;
  }
  if (result.status !== 0)
    throw new Error(`PrusaSlicer failed (${result.status}): ${result.stderr || result.stdout}`);
  return `${result.stdout}${result.stderr}`.trim();
};

await fs.access(profilePath);
try {
  await fs.access(fixtureDir);
} catch {
  throw new Error(`Fixtures are missing at ${fixtureDir}; run pnpm validation:fixtures first.`);
}

const version = run(['--version']);
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
const results: Array<{ fixture: string; output: string; bytes: number; warnings: string[] }> = [];
for (const fixture of files) {
  const input = path.join(fixtureDir, fixture);
  const output = path.join(outputDir, `${fixture.slice(0, -4)}.gcode`);
  const slicerOutput = run(['--load', profilePath, '--export-gcode', input, '--output', output]);
  const warnings = slicerOutput
    .split(/\r?\n/)
    .filter((line) => /warn|repair|invalid|manifold/i.test(line));
  if (warnings.some((line) => /repair|invalid|manifold/i.test(line)))
    throw new Error(
      `PrusaSlicer reported a repair/invalid warning for ${fixture}: ${warnings.join(' ')}`,
    );
  const stat = await fs.stat(output);
  if (stat.size === 0) throw new Error(`PrusaSlicer produced an empty output for ${fixture}`);
  results.push({
    fixture,
    output: path.relative(process.cwd(), output),
    bytes: stat.size,
    warnings,
  });
}

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await fs.writeFile(
  path.join(outputDir, 'result.json'),
  `${JSON.stringify({ schemaVersion: 1, release, sourceCommit, profile: path.relative(process.cwd(), profilePath), slicer: version, results }, null, 2)}\n`,
);
console.log(JSON.stringify({ release, slicer: version, fixtures: results.length, outputDir }));
