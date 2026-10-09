import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

describe('change-based CI workflow', () => {
  it('preserves changed path names and emits a changed-files JSON output', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/validation/commands/validation-ci-changes.mjs'],
      {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', VALIDATION_BASE_SHA: '' },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      conservative: 'true',
    });
    expect(JSON.parse(result.stdout).files.length).toBeGreaterThan(0);
    expect(JSON.parse(result.stdout).changed_files).toBe(
      JSON.stringify(JSON.parse(result.stdout).files),
    );
  });

  it('keeps quality as the required deploy gate and manual dispatch runs exhaustive checks', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('quality:');
    expect(workflow).toContain('needs: quality');
    expect(workflow).toContain('pnpm validate:ci:browser');
    expect(workflow).toContain('pnpm validate:ci:geometry');
    expect(workflow).toContain('pnpm validate:ci:changed');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(workflow.match(/pnpm install --frozen-lockfile/g)).toHaveLength(2);
    expect(existsSync('.github/workflows/netlify.yml')).toBe(false);
  });

  it('does not count an empty static related-test selection as a passing Unit suite', () => {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/validation/commands/run-related-tests.mjs',
        '--source',
        'src/features/customizer/components/ControlsPanel/ControlsPanel.tsx',
        '--test',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(78);
    expect(result.stdout).toContain('Unit: not selected');
  });
});
