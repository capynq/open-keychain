import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const CACHE_VERSION = 1;
const CACHE_DIR = path.join('node_modules', '.cache', 'open-keychain-validation');
const ENV_KEYS = [
  'CI',
  'NODE_ENV',
  'TZ',
  'LANG',
  'VITE_GOOGLE_FONTS_API_KEY',
  'VITE_HOSTED_MODE',
  'PLAYWRIGHT_SMOKE',
  'PLAYWRIGHT_DEPLOYMENT',
  'PLAYWRIGHT_PERFORMANCE',
  'PLAYWRIGHT_USE_EXISTING_BUILD',
  'PLAYWRIGHT_BASE_URL',
  'VALIDATION_CONCURRENCY',
  'VALIDATION_WORKERS',
  'MATRIX_CONCURRENCY',
  'MATRIX_PACKAGE_SIZE',
  'MATRIX_TEMPLATE',
  'MATRIX_SHARD_INDEX',
  'MATRIX_SHARD_COUNT',
];
const cacheRoot = (root) => path.join(root, CACHE_DIR);
const entryDir = (root, gateId, key) =>
  path.join(cacheRoot(root), 'entries', gateId.replaceAll(':', '_'), key);

const walkFiles = async (directory) => {
  const result = [];
  const visit = async (current, relative) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const rel = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(absolute, rel);
      else if (entry.isFile()) result.push({ absolute, relative: rel });
    }
  };
  await visit(directory, '');
  return result;
};

export const validationCacheRoot = cacheRoot;

export const fingerprintFiles = async ({ root, inputFiles }) => {
  const digest = createHash('sha256');
  for (const file of [...new Set(inputFiles)].sort()) {
    digest.update('\0file\0');
    digest.update(file);
    try {
      digest.update(await readFile(path.join(root, file)));
    } catch {
      digest.update('\0missing\0');
    }
  }
  return digest.digest('hex');
};

export const fingerprintGate = async ({
  root,
  gate,
  inputFiles,
  contentFingerprint,
  environment = process.env,
}) => {
  const files = [...new Set(inputFiles)].sort();
  const digest = createHash('sha256');
  digest.update(
    JSON.stringify({
      cacheVersion: CACHE_VERSION,
      id: gate.id,
      command: gate.command,
      args: gate.args ?? [],
      workerSlots: gate.workerSlots ?? 1,
      files,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      tools: { packageManager: 'pnpm@10.27.0' },
    }),
  );
  if (contentFingerprint) digest.update(contentFingerprint);
  else
    for (const file of files) {
      digest.update('\0file\0');
      digest.update(file);
      try {
        digest.update(await readFile(path.join(root, file)));
      } catch {
        digest.update('\0missing\0');
      }
    }
  const environmentNames = new Set([
    ...ENV_KEYS,
    ...Object.keys(environment).filter((name) => /^(?:VITE_|PLAYWRIGHT_|MATRIX_|NODE_)/.test(name)),
  ]);
  for (const name of [...environmentNames].sort()) {
    if (environment[name] === undefined) continue;
    // Only the combined gate key persists; neither the value nor its hash is written to metadata.
    digest.update(`\0env\0${name}\0`);
    digest.update(String(environment[name]));
  }
  return digest.digest('hex');
};

const artifactDigest = async (directory) => {
  const digest = createHash('sha256');
  const files = await walkFiles(directory);
  for (const file of files) {
    digest.update(file.relative);
    digest.update(await readFile(file.absolute));
  }
  return { hash: digest.digest('hex'), files: files.length };
};

export const readSuccessfulResult = async ({ root, gateId, key }) => {
  const directory = entryDir(root, gateId, key);
  let metadata;
  try {
    metadata = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'));
  } catch {
    return { hit: false, reason: 'missing-or-invalid-record' };
  }
  if (
    metadata.version !== CACHE_VERSION ||
    metadata.status !== 'passed' ||
    metadata.key !== key ||
    metadata.gateId !== gateId
  )
    return { hit: false, reason: 'record-version-or-status-mismatch' };
  if (metadata.artifact) {
    const artifact = path.join(directory, 'artifact');
    const actual = await artifactDigest(artifact);
    if (actual.hash !== metadata.artifact.hash || actual.files !== metadata.artifact.files)
      return { hit: false, reason: 'artifact-mismatch' };
  }
  return { hit: true, metadata, directory };
};

export const saveSuccessfulResult = async ({ root, gate, key, durationMs, artifactPath }) => {
  const parent = path.join(cacheRoot(root), 'entries', gate.id.replaceAll(':', '_'));
  const target = path.join(parent, key);
  const locks = path.join(cacheRoot(root), 'locks');
  const lock = path.join(locks, `${gate.id.replaceAll(':', '_')}-${key}.lock`);
  await mkdir(parent, { recursive: true });
  await mkdir(locks, { recursive: true });
  let lockHandle;
  try {
    lockHandle = await open(lock, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let stale = false;
    try {
      const owner = Number((await readFile(lock, 'utf8')).trim());
      if (!Number.isInteger(owner) || owner < 1)
        stale = Date.now() - (await stat(lock)).mtimeMs > 60 * 60 * 1000;
      else {
        try {
          process.kill(owner, 0);
        } catch (probe) {
          if (probe.code === 'ESRCH') stale = true;
        }
      }
    } catch {
      stale = false;
    }
    if (!stale) return { saved: false, reason: 'concurrent-writer' };
    await rm(lock, { force: true });
    try {
      lockHandle = await open(lock, 'wx', 0o600);
    } catch {
      return { saved: false, reason: 'concurrent-writer' };
    }
  }
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    await lockHandle.writeFile(String(process.pid));
    try {
      await stat(target);
      return { saved: false, reason: 'already-saved' };
    } catch {
      /* expected */
    }
    await mkdir(temporary, { recursive: true });
    let artifact;
    if (artifactPath) {
      const destination = path.join(temporary, 'artifact');
      await cp(artifactPath, destination, { recursive: true });
      artifact = await artifactDigest(destination);
    }
    await writeFile(
      path.join(temporary, 'metadata.json'),
      JSON.stringify({
        version: CACHE_VERSION,
        status: 'passed',
        gateId: gate.id,
        key,
        durationMs,
        createdAt: new Date().toISOString(),
        artifact,
      }),
      { mode: 0o600 },
    );
    try {
      await rename(temporary, target);
    } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'ENOTEMPTY') throw error;
      await rm(temporary, { recursive: true, force: true });
      return { saved: false, reason: 'already-saved' };
    }
    return { saved: true };
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await lockHandle?.close();
    await rm(lock, { force: true });
  }
};

export const restoreBuildArtifact = async ({
  root,
  cachedResult,
  outputPath = path.join(root, 'dist'),
}) => {
  if (!cachedResult?.metadata?.artifact) return { restored: false, reason: 'no-artifact' };
  const source = path.join(cachedResult.directory, 'artifact');
  const staged = `${outputPath}.validation-${process.pid}`;
  const backup = `${outputPath}.previous-${process.pid}`;
  await rm(staged, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  await cp(source, staged, { recursive: true });
  try {
    await rename(outputPath, backup);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      await rm(staged, { recursive: true, force: true });
      throw error;
    }
  }
  try {
    await rename(staged, outputPath);
    await rm(backup, { recursive: true, force: true });
    return { restored: true };
  } catch (error) {
    try {
      await rename(backup, outputPath);
    } catch {
      /* preserve original error */
    }
    throw error;
  }
};

export const clearValidationCache = async (root) => {
  await rm(cacheRoot(root), { recursive: true, force: true });
};

export const pruneValidationCache = async ({
  root,
  maxAgeMs = 30 * 24 * 60 * 60 * 1000,
  maxBytes = 2 * 1024 ** 3,
} = {}) => {
  const entriesRoot = path.join(cacheRoot(root), 'entries');
  const directories = [];
  const groups = await readdir(entriesRoot, { withFileTypes: true }).catch(() => []);
  for (const group of groups.filter((entry) => entry.isDirectory())) {
    const groupPath = path.join(entriesRoot, group.name);
    const entries = await readdir(groupPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const directory = path.join(groupPath, entry.name);
      let metadata;
      try {
        metadata = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'));
      } catch {
        metadata = undefined;
      }
      if (!metadata || metadata.version !== CACHE_VERSION || metadata.status !== 'passed') {
        await rm(directory, { recursive: true, force: true });
        continue;
      }
      const files = await walkFiles(directory);
      const bytes = (
        await Promise.all(files.map(async (file) => (await stat(file.absolute)).size))
      ).reduce((sum, size) => sum + size, 0);
      directories.push({ directory, bytes, createdAt: Date.parse(metadata.createdAt) || 0 });
    }
  }
  directories.sort((a, b) => a.createdAt - b.createdAt);
  let total = directories.reduce((sum, item) => sum + item.bytes, 0);
  const cutoff = Date.now() - maxAgeMs;
  for (const item of directories) {
    if (total <= maxBytes && item.createdAt >= cutoff) continue;
    await rm(item.directory, { recursive: true, force: true });
    total -= item.bytes;
  }
};
