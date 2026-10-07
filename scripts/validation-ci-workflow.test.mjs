import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

describe('direct-main CI deployment gate', () => {
  it('runs optional browser and geometry suites on conservative workflow dispatch', () => {
    const result = spawnSync(process.execPath, ['scripts/validation-ci-changes.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', VALIDATION_BASE_SHA: '' },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      conservative: 'true',
      needs_browser: 'true',
      needs_geometry: 'true',
    });
  });

  it('makes the final required-check gate a deploy prerequisite and removes the bypass workflow', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('required-checks:');
    expect(workflow).toContain('needs: [required-checks, production-build]');
    expect(workflow).toContain('echo "browser: not required"');
    expect(workflow).toContain('echo "geometry: not required"');
    expect(existsSync('.github/workflows/netlify.yml')).toBe(false);
  });
});
