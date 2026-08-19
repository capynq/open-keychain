import { readFileSync } from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
};
const capture = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
};
const hasChanges = (args) => spawnSync('git', args).status !== 0;
const isZeroSha = (sha) => !sha || /^0+$/.test(sha);

if (hasChanges(['diff', '--quiet']) || hasChanges(['diff', '--cached', '--quiet'])) {
  process.stderr.write('pre-push: commit or stash tracked changes before automatic repair.\n');
  process.exit(1);
}

const hookInput = readFileSync(0, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const [, localSha, , remoteSha] = (hookInput[0] ?? '').split(/\s+/);
if (localSha && isZeroSha(localSha)) process.exit(0);
const localCommit = localSha || capture(['rev-parse', 'HEAD']).trim();
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const changedArgs = isZeroSha(remoteSha)
  ? ['diff', '--name-only', '-z', '--diff-filter=ACMR', emptyTree, localCommit]
  : ['diff', '--name-only', '-z', '--diff-filter=ACMR', remoteSha, localCommit];
const files = capture(changedArgs).split('\0').filter(Boolean);

if (files.length === 0) process.exit(0);

const script = fileURLToPath(new URL('./validate-changed.mjs', import.meta.url));
run(process.execPath, [script, '--fix', '--', ...files]);
run('git', ['add', '--update', '--', ...files]);
run(process.execPath, [script, '--', ...files]);

const stagedChanges = spawnSync('git', ['diff', '--cached', '--quiet']);
if (stagedChanges.status !== 0) {
  run('git', ['commit', '--amend', '--no-edit', '--no-verify']);
  process.stderr.write('pre-push: automatic fixes were committed; run git push again.\n');
  process.exit(1);
}
