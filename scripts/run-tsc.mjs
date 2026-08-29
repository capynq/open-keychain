import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('@typescript/native/package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const majorVersion = Number.parseInt(packageJson.version.split('.')[0], 10);

if (packageJson.name !== 'typescript' || majorVersion !== 7) {
  throw new Error(
    `Expected @typescript/native to resolve TypeScript 7, got ${packageJson.name}@${packageJson.version}`,
  );
}

const result = spawnSync(
  process.execPath,
  [join(dirname(packageJsonPath), 'bin', 'tsc'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
if (result.signal) process.kill(process.pid, result.signal);
process.exitCode = result.status ?? 1;
