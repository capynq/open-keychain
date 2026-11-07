import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('generate-font-specimens --check', () => {
  it('matches the committed sprite and metrics', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/generators/generate-font-specimens.ts', '--check'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
  }, 60_000);
});
