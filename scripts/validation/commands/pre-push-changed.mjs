import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync(
  process.execPath,
  ['scripts/validation/commands/run-validation-gates.mjs', 'push'],
  {
    stdio: 'inherit',
    // git pipes the pushed refs on stdin and closes it; opt in to reading them.
    env: { ...process.env, VALIDATION_PRE_PUSH_STDIN: '1' },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
