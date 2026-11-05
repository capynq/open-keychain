import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { clearValidationCache } from '../core/validation-cache.mjs';
import {
  CI_GATE_GROUPS,
  ciGateGroup,
  createCiChangedGatePlan,
  createGatePlan,
} from '../core/validation-plan.mjs';
import {
  collectPushChanges,
  assertCleanValidationInputs,
  withCleanValidationWorkspace,
} from '../core/validation-git.mjs';
import { runValidationGates } from '../core/runner.mjs';

const ROOT = process.cwd();

const parseMode = () => {
  const mode = process.env.VALIDATION_UI ?? 'auto';
  if (!['auto', 'tui', 'plain'].includes(mode))
    throw new Error(`VALIDATION_UI must be auto, tui, or plain (received ${mode}).`);
  return mode;
};

/* Only pre-push closes stdin; others may hang */
export const PRE_PUSH_STDIN_ENV = 'VALIDATION_PRE_PUSH_STDIN';
export const readPushHookInput = async ({ stdin = process.stdin, env = process.env } = {}) => {
  if (env[PRE_PUSH_STDIN_ENV] !== '1' || stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

export const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'ci';
  if (command === 'cache-clear') {
    await clearValidationCache(ROOT);
    process.stdout.write('Validation cache cleared.\n');
    return;
  }
  let files;
  if (command === 'push' || command === 'bench-push') {
    const input = command === 'push' ? await readPushHookInput() : '';
    const executePush = async () => {
      let changes;
      if (command === 'push') {
        await assertCleanValidationInputs({ root: ROOT });
        changes = collectPushChanges({ hookInput: input, root: ROOT });
      } else {
        const working = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD'], {
          cwd: ROOT,
          encoding: 'utf8',
        })
          .split('\0')
          .filter(Boolean);
        const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
          cwd: ROOT,
          encoding: 'utf8',
        })
          .split('\0')
          .filter(Boolean);
        const untracked = execFileSync(
          'git',
          ['ls-files', '--others', '--exclude-standard', '-z'],
          {
            cwd: ROOT,
            encoding: 'utf8',
          },
        )
          .split('\0')
          .filter(Boolean);
        changes = {
          files: [...new Set([...working, ...staged, ...untracked])].sort(),
          branch: process.env.VALIDATION_BRANCH ?? 'benchmark',
          head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
          conservative: false,
        };
      }
      files = changes.files;
      const branch = changes.branch;
      const sha = changes.head.slice(0, 10);
      if ('deletedOnly' in changes && changes.deletedOnly) {
        process.stdout.write('No pushed file changes require validation.\n');
        return;
      }
      if (changes.conservative)
        process.stdout.write('Git baseline unavailable; using conservative full validation.\n');
      const gates = createGatePlan(files, changes.conservative ? 'full' : 'push');
      const outcome = await runValidationGates(gates, {
        files,
        profile: 'quick',
        branch,
        sha,
        mode: parseMode(),
      });
      process.exitCode = outcome.ok ? 0 : 1;
    };
    if (command === 'push') {
      await withCleanValidationWorkspace(
        {
          root: ROOT,
          onCleanup: ({ removedFinderFiles = [], isolatedEnvFiles = [] }) => {
            if (removedFinderFiles.length)
              process.stdout.write(`Removed Finder metadata: ${removedFinderFiles.join(', ')}\n`);
            if (isolatedEnvFiles.length)
              process.stdout.write(
                `Temporarily isolated local env files for validation (will restore): ${isolatedEnvFiles.join(', ')}\n`,
              );
          },
        },
        executePush,
      );
    } else await executePush();
    return;
  }
  const profile =
    command === 'full'
      ? 'full'
      : command === 'ci'
        ? 'ci'
        : command === 'ci-browser'
          ? 'ci-browser'
          : command === 'ci-geometry'
            ? 'ci-geometry'
            : command === 'ci-changed'
              ? 'ci-changed'
              : command === 'bench-ui'
                ? 'bench-ui'
                : command === 'bench-geometry'
                  ? 'bench-geometry'
                  : command === 'bench-docs'
                    ? 'bench-docs'
                    : null;
  if (!profile) throw new Error(`Unknown validation profile: ${command}`);
  const tracked = (await import('node:child_process'))
    .execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  files = profile === 'ci' || profile === 'full' ? tracked : [];
  if (profile === 'ci-changed') {
    try {
      files = JSON.parse(process.env.CHANGED_FILES_JSON ?? '[]');
    } catch {
      throw new Error('CHANGED_FILES_JSON must contain a JSON array of changed paths.');
    }
    if (!Array.isArray(files) || files.some((file) => typeof file !== 'string'))
      throw new Error('CHANGED_FILES_JSON must contain a JSON array of changed paths.');
  }
  const group = process.env.VALIDATION_GATE_GROUP || undefined;
  if (group && (profile !== 'ci-changed' || !CI_GATE_GROUPS.includes(group)))
    throw new Error(
      `VALIDATION_GATE_GROUP applies to ci-changed and must be one of ${CI_GATE_GROUPS.join(', ')}; received ${group}.`,
    );
  const planned =
    profile === 'ci-changed' ? createCiChangedGatePlan(files) : createGatePlan(files, profile);
  const gates = group ? planned.filter((gate) => ciGateGroup(gate) === group) : planned;
  if (profile === 'ci-changed') {
    if ((!group || group === 'unit') && !gates.some((gate) => gate.id.startsWith('unit')))
      process.stdout.write('Unit: not selected (no related test files found for this change).\n');
    if ((!group || group === 'browser') && !gates.some((gate) => gate.id.startsWith('browser')))
      process.stdout.write('Browser: not selected for this change.\n');
    if (!group && !gates.some((gate) => gate.id === 'geometry'))
      process.stdout.write('Full Geometry matrix: not selected; run pnpm validate:full locally.\n');
    if (!gates.length) {
      process.stdout.write(`No ${group ?? 'CI'} checks selected for this change.\n`);
      return;
    }
  }
  const outcome = await runValidationGates(gates, {
    files,
    profile,
    mode: parseMode(),
    failFast: profile !== 'ci',
  });
  process.exitCode = outcome.ok ? 0 : 1;
};

if (process.argv[1]?.endsWith('run-validation-gates.mjs')) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
