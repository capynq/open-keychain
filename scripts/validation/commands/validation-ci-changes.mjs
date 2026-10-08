import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { classifyChangedFiles } from '../core/validation-plan.mjs';

const git = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout;
};
let base = process.env.VALIDATION_BASE_SHA;
let conservative = false;
if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_BASE_REF) {
  const mergeBase = spawnSync(
    'git',
    ['merge-base', `origin/${process.env.GITHUB_BASE_REF}`, 'HEAD'],
    { encoding: 'utf8' },
  );
  if (mergeBase.status === 0) base = mergeBase.stdout.trim();
  else conservative = true;
}
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') conservative = true;
const zeroSha = !base || /^0+$/.test(base);
let files;
if (conservative || zeroSha) {
  files = git(['ls-files', '-z']).split('\0').filter(Boolean);
  conservative = true;
} else {
  const exists = spawnSync('git', ['cat-file', '-e', `${base}^{commit}`]);
  const ancestor =
    exists.status === 0
      ? spawnSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'])
      : { status: 1 };
  if (exists.status !== 0 || ancestor.status !== 0) {
    files = git(['ls-files', '-z']).split('\0').filter(Boolean);
    conservative = true;
  } else
    files = git(['diff', '--name-only', '-z', '--no-renames', base, 'HEAD'])
      .split('\0')
      .filter(Boolean);
}
const classification = classifyChangedFiles(files);
const needsBrowser = conservative || classification.needsBrowser || classification.conservative;
const needsGeometry =
  conservative ||
  classification.needsGeometry ||
  classification.needsExport ||
  classification.conservative;
const outputs = {
  needs_browser: String(needsBrowser),
  needs_geometry: String(needsGeometry),
  conservative: String(conservative),
  changed_count: String(files.length),
};
process.stdout.write(`${JSON.stringify({ ...outputs, files })}\n`);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
  );
