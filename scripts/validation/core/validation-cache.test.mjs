import { mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearValidationCache,
  fingerprintGate,
  pruneValidationCache,
  readSuccessfulResult,
  restoreBuildArtifact,
  saveSuccessfulResult,
  validationCacheRoot,
} from './validation-cache.mjs';

const roots = [];
const createRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'validation-cache-'));
  roots.push(root);
  await writeFile(path.join(root, 'input.ts'), 'export const value = 1;');
  await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  return root;
};
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe('local validation cache', () => {
  it('invalidates code and lockfile changes', async () => {
    const root = await createRoot();
    const gate = { id: 'unit', command: 'pnpm', args: ['test'] };
    const first = await fingerprintGate({ root, gate, inputFiles: ['input.ts', 'pnpm-lock.yaml'] });
    await writeFile(path.join(root, 'input.ts'), 'export const value = 2;');
    const sourceChanged = await fingerprintGate({
      root,
      gate,
      inputFiles: ['input.ts', 'pnpm-lock.yaml'],
    });
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n# updated');
    const lockChanged = await fingerprintGate({
      root,
      gate,
      inputFiles: ['input.ts', 'pnpm-lock.yaml'],
    });
    expect(new Set([first, sourceChanged, lockChanged]).size).toBe(3);
  });

  it('invalidates font, WASM and check configuration inputs', async () => {
    const root = await createRoot();
    await mkdir(path.join(root, 'public', 'fonts'), { recursive: true });
    await writeFile(path.join(root, 'public', 'fonts', 'fixture.woff2'), 'font-one');
    await writeFile(path.join(root, 'public', 'manifold.wasm'), 'wasm-one');
    await writeFile(path.join(root, 'vitest.config.ts'), 'export default 1;');
    const gate = { id: 'geometry', command: 'pnpm', args: ['bench:matrix'] };
    const inputFiles = ['public/fonts/fixture.woff2', 'public/manifold.wasm', 'vitest.config.ts'];
    const baseline = await fingerprintGate({ root, gate, inputFiles });
    await writeFile(path.join(root, 'public', 'fonts', 'fixture.woff2'), 'font-two');
    const font = await fingerprintGate({ root, gate, inputFiles });
    await writeFile(path.join(root, 'public', 'manifold.wasm'), 'wasm-two');
    const wasm = await fingerprintGate({ root, gate, inputFiles });
    await writeFile(path.join(root, 'vitest.config.ts'), 'export default 2;');
    const config = await fingerprintGate({ root, gate, inputFiles });
    expect(new Set([baseline, font, wasm, config]).size).toBe(4);
  });

  it('stores only versioned success and restores a digest-checked build artifact', async () => {
    const root = await createRoot();
    const artifactPath = path.join(root, 'dist-source');
    await mkdir(artifactPath);
    await writeFile(path.join(artifactPath, 'index.html'), '<main>validated</main>');
    const gate = { id: 'build', command: 'pnpm', args: ['build'] };
    const key = await fingerprintGate({ root, gate, inputFiles: ['input.ts'] });
    await saveSuccessfulResult({ root, gate, key, durationMs: 123, artifactPath });
    const hit = await readSuccessfulResult({ root, gateId: 'build', key });
    expect(hit.hit).toBe(true);
    const restored = await restoreBuildArtifact({
      root,
      cachedResult: hit,
      outputPath: path.join(root, 'dist'),
    });
    expect(restored.restored).toBe(true);
    expect(await readFile(path.join(root, 'dist', 'index.html'), 'utf8')).toBe(
      '<main>validated</main>',
    );
    expect(
      JSON.parse(
        await readFile(
          path.join(validationCacheRoot(root), 'entries', 'build', key, 'metadata.json'),
          'utf8',
        ),
      ),
    ).toMatchObject({ status: 'passed', gateId: 'build', key });
    await writeFile(
      path.join(validationCacheRoot(root), 'entries', 'build', key, 'artifact', 'index.html'),
      '<main>tampered</main>',
    );
    expect(await readSuccessfulResult({ root, gateId: 'build', key })).toMatchObject({
      hit: false,
      reason: 'artifact-mismatch',
    });
  });

  it('serializes concurrent writers and clears only its own cache', async () => {
    const root = await createRoot();
    const gate = { id: 'lint', command: 'pnpm', args: ['lint'] };
    const key = await fingerprintGate({ root, gate, inputFiles: ['input.ts'] });
    const results = await Promise.all([
      saveSuccessfulResult({ root, gate, key, durationMs: 1 }),
      saveSuccessfulResult({ root, gate, key, durationMs: 1 }),
    ]);
    expect(results.filter((item) => item.saved)).toHaveLength(1);
    await writeFile(path.join(root, 'keep.txt'), 'keep');
    await clearValidationCache(root);
    expect(await readFile(path.join(root, 'keep.txt'), 'utf8')).toBe('keep');
    expect(await readSuccessfulResult({ root, gateId: 'lint', key })).toMatchObject({ hit: false });
  });

  it('preserves active cache writes and removes stale temporary entries', async () => {
    const root = await createRoot();
    const entries = path.join(validationCacheRoot(root), 'entries', 'build');
    const active = path.join(entries, `active.tmp-${process.pid}-${Date.now()}`);
    const stale = path.join(entries, `stale.tmp-99999999-${Date.now()}`);
    await mkdir(active, { recursive: true });
    await mkdir(stale, { recursive: true });
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000 - 1000);
    await utimes(stale, hourAgo, hourAgo);

    await pruneValidationCache({ root });

    expect((await stat(active)).isDirectory()).toBe(true);
    await expect(stat(stale)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
