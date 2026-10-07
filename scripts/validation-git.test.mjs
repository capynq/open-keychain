import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertCleanValidationInputs,
  collectPushChanges,
  parsePrePushInput,
} from './validation-git.mjs';

const roots = [];
const createRepo = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'validation-git-'));
  roots.push(root);
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'validation@example.test'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Validation Test'], { cwd: root });
  await writeFile(path.join(root, 'README.md'), 'initial\n');
  execFileSync('git', ['add', 'README.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: root });
  return root;
};
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe('push checkout and change detection', () => {
  it('parses ref input and accepts the exact pushed HEAD', async () => {
    const root = await createRepo();
    await writeFile(path.join(root, 'README.md'), 'updated\n');
    git(root, 'add', 'README.md');
    git(root, 'commit', '-m', 'docs');
    const head = git(root, 'rev-parse', 'HEAD');
    const previous = git(root, 'rev-parse', 'HEAD^');
    const hookInput = `refs/heads/main ${head} refs/remotes/origin/main ${previous}\n`;
    expect(parsePrePushInput(hookInput)).toHaveLength(1);
    expect(collectPushChanges({ hookInput, root }).files).toEqual(['README.md']);
  });

  it('fails when the pushed SHA differs from the checked out SHA', async () => {
    const root = await createRepo();
    const head = git(root, 'rev-parse', 'HEAD');
    expect(() =>
      collectPushChanges({
        hookInput: `refs/heads/main ${'1'.repeat(40)} refs/remotes/origin/main ${head}`,
        root,
      }),
    ).toThrow(/differ from the checked-out HEAD/);
  });

  it('treats ref deletions as no validation work', async () => {
    const root = await createRepo();
    const head = git(root, 'rev-parse', 'HEAD');
    const result = collectPushChanges({
      hookInput: `refs/heads/main ${'0'.repeat(40)} refs/remotes/origin/main ${head}`,
      root,
    });
    expect(result.deletedOnly).toBe(true);
    expect(result.files).toEqual([]);
  });

  it('uses the empty tree for the first main push and conservative fallback for unknown baseline', async () => {
    const root = await createRepo();
    const head = git(root, 'rev-parse', 'HEAD');
    const first = collectPushChanges({
      hookInput: `refs/heads/main ${head} refs/remotes/origin/main ${'0'.repeat(40)}`,
      root,
    });
    expect(first.files).toEqual(['README.md']);
    const unknown = collectPushChanges({
      hookInput: `refs/heads/main ${head} refs/remotes/origin/main ${'f'.repeat(40)}`,
      root,
    });
    expect(unknown.conservative).toBe(true);
    expect(unknown.files).toContain('README.md');
  });

  it('rejects tracked modifications and untracked validation inputs', async () => {
    const root = await createRepo();
    await writeFile(path.join(root, 'README.md'), 'dirty\n');
    await expect(assertCleanValidationInputs({ root })).rejects.toThrow(/tracked changes/);
    git(root, 'checkout', '--', 'README.md');
    await mkdir(path.join(root, 'src'));
    await writeFile(path.join(root, 'src', 'untracked.ts'), 'export {};\n');
    await expect(assertCleanValidationInputs({ root })).rejects.toThrow(
      /validation inputs must be tracked/,
    );
  });

  it('does not claim different pushed refs were checked by one checkout', async () => {
    const root = await createRepo();
    const head = git(root, 'rev-parse', 'HEAD');
    expect(() =>
      collectPushChanges({
        hookInput: `refs/heads/main ${head} refs/remotes/origin/main ${head}\nrefs/heads/other ${'1'.repeat(40)} refs/remotes/origin/other ${head}`,
        root,
      }),
    ).toThrow(/differ from the checked-out HEAD/);
  });
});
