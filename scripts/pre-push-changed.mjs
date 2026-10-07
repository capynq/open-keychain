import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync(process.execPath, ['scripts/run-validation-gates.mjs', 'push'], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
