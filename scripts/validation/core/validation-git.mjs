import { spawnSync } from 'node:child_process';
import { lstat, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const GIT_CONTEXT_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_SUPER_PREFIX',
  'GIT_NAMESPACE',
];
export const isZeroSha = (sha) => !sha || /^0+$/.test(sha);

const git = (args, { cwd = process.cwd(), allowFailure = false } = {}) => {
  const env = { ...process.env };
  for (const key of GIT_CONTEXT_ENV) delete env[key];
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env });
  if (result.status !== 0 && !allowFailure)
    throw new Error((result.stderr || `git ${args.join(' ')} failed`).trim());
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

export const parsePrePushInput = (input = '') =>
  input
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
      if (!localRef || !localSha || !remoteRef || !remoteSha)
        throw new Error(`Invalid pre-push ref line: ${line}`);
      return { localRef, localSha, remoteRef, remoteSha };
    });

const trackedPaths = (root) =>
  git(['ls-files', '-z'], { cwd: root }).stdout.split('\0').filter(Boolean);
const changedBetween = (base, head, root) =>
  git(['diff', '--name-only', '-z', '--no-renames', '--diff-filter=ACDMRT', base, head], {
    cwd: root,
  })
    .stdout.split('\0')
    .filter(Boolean);
const isAncestor = (base, head, root) =>
  git(['merge-base', '--is-ancestor', base, head], { cwd: root, allowFailure: true }).status === 0;
const hasCommit = (sha, root) =>
  git(['cat-file', '-e', `${sha}^{commit}`], { cwd: root, allowFailure: true }).status === 0;

export const collectPushChanges = ({
  hookInput = '',
  root = process.cwd(),
  baseRef = 'origin/main',
} = {}) => {
  const refs = Array.isArray(hookInput) ? hookInput : parsePrePushInput(hookInput);
  const currentSha = git(['rev-parse', 'HEAD'], { cwd: root }).stdout.trim();
  const branch = git(['branch', '--show-current'], { cwd: root }).stdout.trim() || '(detached)';
  const liveRefs = refs.filter((ref) => !isZeroSha(ref.localSha));
  if (liveRefs.length && liveRefs.some((ref) => ref.localSha !== currentSha)) {
    const mismatches = liveRefs
      .filter((ref) => ref.localSha !== currentSha)
      .map((ref) => `${ref.localRef}=${ref.localSha.slice(0, 12)}`);
    throw new Error(
      `pre-push cannot validate refs that differ from the checked-out HEAD (${currentSha.slice(0, 12)}): ${mismatches.join(', ')}. Check out each pushed commit and validate it separately.`,
    );
  }
  if (liveRefs.length > 1 && new Set(liveRefs.map((ref) => ref.localSha)).size > 1) {
    throw new Error(
      'pre-push received multiple different commits; validate each pushed ref from its own checkout.',
    );
  }
  if (refs.length > 0 && liveRefs.length === 0)
    return { branch, head: currentSha, files: [], deletedOnly: true, conservative: false, refs };

  let conservative = false;
  const ranges = [];
  if (refs.length === 0) {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], {
      cwd: root,
      allowFailure: true,
    });
    if (upstream.status === 0) {
      const baseline = git(['merge-base', upstream.stdout.trim(), currentSha], {
        cwd: root,
        allowFailure: true,
      });
      if (baseline.status === 0) ranges.push([baseline.stdout.trim(), currentSha]);
      else conservative = true;
    } else conservative = true;
  } else {
    for (const ref of liveRefs) {
      if (isZeroSha(ref.remoteSha)) {
        if (ref.localRef === 'refs/heads/main') {
          ranges.push([EMPTY_TREE, ref.localSha]);
          continue;
        }
        const mergeBase = git(['merge-base', baseRef, ref.localSha], {
          cwd: root,
          allowFailure: true,
        });
        if (mergeBase.status === 0) ranges.push([mergeBase.stdout.trim(), ref.localSha]);
        else conservative = true;
      } else if (
        !hasCommit(ref.remoteSha, root) ||
        !isAncestor(ref.remoteSha, ref.localSha, root)
      ) {
        conservative = true;
      } else ranges.push([ref.remoteSha, ref.localSha]);
    }
  }

  let files;
  if (conservative || ranges.length === 0) files = trackedPaths(root);
  else
    files = [...new Set(ranges.flatMap(([base, head]) => changedBetween(base, head, root)))].sort();
  return { branch, head: currentSha, files, deletedOnly: false, conservative, refs };
};

export const assertCleanValidationInputs = async ({ root = process.cwd() } = {}) => {
  const unstaged = git(['diff', '--quiet'], { cwd: root, allowFailure: true });
  const staged = git(['diff', '--cached', '--quiet'], { cwd: root, allowFailure: true });
  if (unstaged.status !== 0 || staged.status !== 0)
    throw new Error('pre-push: commit or stash tracked changes before validation.');

  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root })
    .stdout.split('\0')
    .filter(Boolean);
  const ignoredValidationInputs = git(
    [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '-z',
      '--',
      'src',
      'public',
      'e2e',
      'scripts',
      'tests',
      'tools',
    ],
    { cwd: root },
  )
    .stdout.split('\0')
    .filter(Boolean);
  const rootEntries = await readdir(root);
  const envFiles = rootEntries.filter((name) => name.startsWith('.env') && name !== '.env.example');
  const affecting = [...new Set([...untracked, ...ignoredValidationInputs, ...envFiles])];
  if (affecting.length)
    throw new Error(
      `pre-push: validation inputs must be tracked by the pushed commit; remove or add these files before validation: ${affecting.slice(0, 12).join(', ')}${affecting.length > 12 ? ` and ${affecting.length - 12} more` : ''}`,
    );
};

const ignoredEnvFiles = async (root) => {
  const tracked = new Set(trackedPaths(root));
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.name.startsWith('.env') || entry.name === '.env.example' || tracked.has(entry.name))
      continue;
    if (
      git(['check-ignore', '-q', '--', entry.name], { cwd: root, allowFailure: true }).status !== 0
    )
      continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    try {
      await lstat(path.join(root, entry.name));
      files.push(entry.name);
    } catch {
      // A concurrently removed environment file needs no isolation.
    }
  }
  return files;
};

const removeUntrackedFinderFiles = async (root) => {
  const tracked = new Set(trackedPaths(root));
  const removed = [];
  const excluded = new Set([
    '.git',
    'node_modules',
    '.pnpm-store',
    'dist',
    'artifacts',
    '.netlify',
  ]);
  const visit = async (directory, relative = '') => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (relative === '' && excluded.has(entry.name)) continue;
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.name === '.DS_Store' && !tracked.has(childRelative)) {
        await rm(absolute, { force: true });
        removed.push(childRelative);
      } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
        await visit(absolute, childRelative);
      }
    }
  };
  await visit(root);
  return removed;
};

/**
 * Keep ignored machine-local environment files away from Vite/build/test discovery during the
 * push check, then restore them even when validation fails or is cancelled. Finder metadata files
 * are harmless and removed automatically. Neither kind of file is staged or added to Git.
 */
export const withCleanValidationWorkspace = async (
  { root = process.cwd(), onCleanup = () => {} } = {},
  task,
) => {
  const removedFinderFiles = await removeUntrackedFinderFiles(root);
  if (removedFinderFiles.length) onCleanup({ removedFinderFiles });

  const envFiles = await ignoredEnvFiles(root);
  if (envFiles.length === 0) return task();

  const quarantine = await mkdtemp(path.join(os.tmpdir(), 'open-keychain-validation-env-'));
  const moved = [];
  let result;
  let taskError;
  try {
    for (const name of envFiles) {
      const source = path.join(root, name);
      const target = path.join(quarantine, name);
      await rename(source, target);
      moved.push({ source, target });
    }
    onCleanup({ isolatedEnvFiles: envFiles });
    result = await task();
  } catch (error) {
    taskError = error;
  }
  const restoreErrors = [];
  for (const { source, target } of moved.reverse()) {
    try {
      await rename(target, source);
    } catch (error) {
      restoreErrors.push(`${path.basename(source)} (${error.message})`);
    }
  }
  if (restoreErrors.length)
    throw new Error(
      `Validation finished but could not restore local environment file(s): ${restoreErrors.join(', ')}. Recover them from ${quarantine}.`,
      { cause: taskError },
    );
  await rm(quarantine, { recursive: true, force: true });
  if (taskError) throw taskError;
  return result;
};

export const diffFromBase = ({ root = process.cwd(), baseRef = 'origin/main' } = {}) => {
  const head = git(['rev-parse', 'HEAD'], { cwd: root }).stdout.trim();
  const base = git(['merge-base', baseRef, head], { cwd: root, allowFailure: true });
  return base.status === 0
    ? { head, files: changedBetween(base.stdout.trim(), head, root), conservative: false }
    : { head, files: trackedPaths(root), conservative: true };
};
