import { spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const separator = args.indexOf('--test');
const sourceArgs = args.slice(0, separator < 0 ? args.length : separator);
const sources = sourceArgs[0] === '--source' ? sourceArgs.slice(1) : sourceArgs;
const tests = separator < 0 ? [] : args.slice(separator + 1);
let selected = false;

const run = (runArgs) => {
  const result = spawnSync('pnpm', ['exec', 'vitest', ...runArgs], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (/No test files found|No tests found/i.test(`${result.stdout}\n${result.stderr}`))
    return false;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return true;
};

if (sources.length) selected = run(['related', '--run', ...sources]);
if (tests.length) selected = run(['run', ...tests]) || selected;
if (!selected) {
  process.stdout.write('Unit: not selected (Vitest found no statically related tests).\n');
  process.exit(78);
}
