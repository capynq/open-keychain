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
    expect(workflow).not.toContain('pnpm install');
    expect(workflow.match(/uses: \.\/\.github\/actions\/setup$/gm)).toHaveLength(5);
    expect(
      readFileSync('.github/actions/setup/action.yml', 'utf8').match(
        /pnpm install --frozen-lockfile/g,
      ),
    ).toHaveLength(1);
    expect(existsSync('.github/workflows/netlify.yml')).toBe(false);
  });

  it('runs selected gates in parallel jobs and reports them as one quality status', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const job = (name) => {
      const start = workflow.indexOf(`\n  ${name}:\n`);
      const next = workflow.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
      return workflow.slice(start, next < 0 ? undefined : start + 1 + next);
    };
    for (const [name, concurrency] of [
      ['static', 3],
      ['unit', 4],
      ['browser', 2],
    ]) {
      expect(job(name)).toContain('needs: changes');
      expect(job(name)).toContain(`VALIDATION_GATE_GROUP: ${name}`);
      expect(job(name)).toContain(`VALIDATION_CONCURRENCY: ${concurrency}`);
      expect(job(name)).toContain(`needs.changes.outputs.needs_${name} == 'true'`);
    }
    expect(job('browser')).toContain("needs.changes.outputs.merged_pr != 'true'");
    expect(job('changes')).toContain('repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls');
    expect(job('changes')).toContain('pull-requests: read');
    expect(job('quality')).toContain('needs: [changes, static, unit, browser, full]');
    expect(job('quality')).toContain('if: ${{ !cancelled() }}');
    expect(job('quality')).toContain(
      'all(.value.result == "success" or .value.result == "skipped")',
    );
    expect(job('production-build')).toContain("needs.quality.result == 'success'");
    expect(job('deploy')).toContain("needs.production-build.result == 'success'");
    const chromium = readFileSync('.github/actions/chromium/action.yml', 'utf8');
    expect(chromium).toContain('pnpm exec playwright install chromium');
    expect(chromium).not.toContain('--with-deps');
    expect(chromium).toContain('pnpm exec playwright install-deps chromium');
  });

  it('installs browser coverage for changed journeys and verifies the exact production artifact', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const productionBuild = workflow.slice(
      workflow.indexOf('\n  production-build:'),
      workflow.indexOf('\n  deploy:'),
    );
    expect(workflow).toContain("needs.changes.outputs.needs_browser == 'true'");
    expect(workflow.match(/uses: \.\/\.github\/actions\/chromium$/gm)).toHaveLength(3);
    expect(productionBuild).toContain('name: Verify production artifact user journey and exports');
    expect(productionBuild).toContain('run: pnpm test:e2e:journey');
    const productionSmoke = productionBuild.slice(
      productionBuild.indexOf('name: Verify production artifact user journey and exports'),
      productionBuild.indexOf('uses: actions/upload-artifact@'),
    );
    expect(productionSmoke).toContain("PLAYWRIGHT_BASE_URL: ''");
    expect(productionSmoke).toContain("PLAYWRIGHT_USE_EXISTING_BUILD: 'true'");
    expect(productionBuild.indexOf('run: pnpm test:e2e:journey')).toBeLessThan(
      productionBuild.indexOf('actions/upload-artifact'),
    );
    expect(workflow).toMatch(/deploy:\n\s+needs: \[quality, production-build\]/);
  });

  it('uploads production source maps before removing them from the deploy artifact', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const productionBuild = workflow.slice(
      workflow.indexOf('\n  production-build:'),
      workflow.indexOf('\n  deploy:'),
    );
    const inject = productionBuild.indexOf('pnpm dlx @posthog/cli@0.19.0 sourcemap inject');
    const check = productionBuild.indexOf(
      'node scripts/validation/commands/check-sourcemaps.mjs dist',
    );
    const upload = productionBuild.indexOf('pnpm dlx @posthog/cli@0.19.0 sourcemap upload');
    const removal = productionBuild.indexOf("find dist -type f -name '*.map' -delete");
    const artifact = productionBuild.indexOf('actions/upload-artifact');

    expect(productionBuild).toContain("POSTHOG_UPLOAD_SOURCEMAPS: 'true'");
    expect(productionBuild).toContain('POSTHOG_CLI_API_KEY');
    expect(productionBuild).toContain("POSTHOG_CLI_PROJECT_ID: '251074'");
    expect(inject).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(inject);
    expect(upload).toBeGreaterThan(check);
    expect(productionBuild).not.toContain("find dist/assets -name 'app-*.js.map'");
    expect(removal).toBeGreaterThan(upload);
    expect(artifact).toBeGreaterThan(removal);
  });

  it('does not count an empty static related-test selection as a passing Unit suite', () => {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/validation/commands/run-related-tests.mjs',
        '--source',
        'scripts/validation/commands/__fixtures__/untested-source.ts',
        '--test',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(78);
    expect(result.stdout).toContain('Unit: not selected');
  }, 30000);
});
