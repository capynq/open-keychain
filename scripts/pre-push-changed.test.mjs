import { describe, expect, it } from 'vitest';
import { classifyChangedFiles, collectChangedFiles } from './pre-push-changed.mjs';

describe('classifyChangedFiles', () => {
  it('keeps documentation-only pushes on changed-file validation', () => {
    expect(classifyChangedFiles(['README.md', 'docs/hosting-readiness.md'])).toEqual({
      documentationOnly: true,
      needsCoreValidation: false,
      needsBrowserValidation: false,
      needsGeometryBenchmark: false,
      needsDockerValidation: false,
    });
  });

  it('selects the browser gate for UI and route changes', () => {
    const result = classifyChangedFiles(['src/features/customizer/components/Editor.tsx']);
    expect(result.needsCoreValidation).toBe(true);
    expect(result.needsBrowserValidation).toBe(true);
    expect(result.needsGeometryBenchmark).toBe(false);
    expect(result.needsDockerValidation).toBe(false);
  });

  it('keeps deleted application files in gate classification', () => {
    const result = classifyChangedFiles(['src/features/export/RemovedExporter.ts']);
    expect(result.needsCoreValidation).toBe(true);
    expect(result.needsBrowserValidation).toBe(true);
  });

  it('selects the geometry matrix for geometry and font changes', () => {
    const result = classifyChangedFiles([
      'src/infrastructure/geometry/worker.ts',
      'public/fonts/lobster.ttf',
    ]);
    expect(result.needsCoreValidation).toBe(true);
    expect(result.needsGeometryBenchmark).toBe(true);
    expect(result.needsBrowserValidation).toBe(true);
    expect(result.needsDockerValidation).toBe(false);
  });

  it('selects Compose and self-hosted validation for hosting changes', () => {
    const result = classifyChangedFiles(['docker-compose.yml', 'nginx.conf']);
    expect(result.needsCoreValidation).toBe(true);
    expect(result.needsDockerValidation).toBe(true);
    expect(result.needsBrowserValidation).toBe(false);
    expect(result.needsGeometryBenchmark).toBe(false);
  });

  it('collects changed files from every pushed ref and includes deletions', () => {
    const calls = [];
    const files = collectChangedFiles(
      [
        'refs/heads/main aaa refs/remotes/origin/main bbb',
        'refs/heads/feature ccc refs/remotes/origin/feature ddd',
      ],
      (args) => {
        calls.push(args);
        return calls.length === 1 ? 'src/app/App.tsx\0src/old.ts\0' : 'docs/notes.md\0';
      },
    );
    expect(calls).toHaveLength(2);
    expect(files).toEqual(['src/app/App.tsx', 'src/old.ts', 'docs/notes.md']);
    expect(calls[0]).toContain('--diff-filter=ACMRD');
  });
});
