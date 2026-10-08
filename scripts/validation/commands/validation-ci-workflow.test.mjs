import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { MATRIX_SHARD_COUNT } from '../../geometry/matrix/matrix-contract';

describe('required CI deployment gate', () => {
  it('requires browser and geometry suites on conservative workflow dispatch', () => {
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
      needs_browser: 'true',
      needs_geometry: 'true',
    });
  });

  it('requires full browser and geometry suites before deployment and removes the bypass workflow', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const shardIds = workflow
      .match(/^\s*shard: \[([^\]]+)\]$/m)?.[1]
      ?.split(',')
      .map((shard) => Number(shard.trim()));
    expect(workflow).toContain('quality:');
    expect(workflow).toContain('needs: [quality, production-build]');
    expect(shardIds).toEqual(Array.from({ length: MATRIX_SHARD_COUNT }, (_, index) => index));
    expect(workflow).toContain(`MATRIX_SHARD_COUNT: ${MATRIX_SHARD_COUNT}`);
    expect(workflow).toContain(`max-parallel: ${MATRIX_SHARD_COUNT}`);
    expect(workflow).toContain('pnpm validate:ci:browser');
    expect(workflow).toContain('pnpm validate:ci:geometry');
    expect(workflow).toContain('echo "browser: $BROWSER (required)"');
    expect(workflow).toContain('echo "geometry: $GEOMETRY (required)"');
    expect(existsSync('.github/workflows/netlify.yml')).toBe(false);
  });
});
