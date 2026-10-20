import { describe, expect, it, vi } from 'vitest';

import { resolveBuildVersion } from './build-version.ts';

const options = (overrides: Partial<Parameters<typeof resolveBuildVersion>[0]> = {}) => ({
  env: {},
  environment: 'preview' as const,
  repoRoot: '/repo',
  readGitSha: vi.fn(() => undefined),
  ...overrides,
});

describe('resolveBuildVersion', () => {
  it('uses the first valid supplied SHA in precedence order and normalizes it', () => {
    expect(
      resolveBuildVersion(
        options({
          env: {
            GITHUB_SHA: 'invalid',
            VITE_APP_VERSION: 'ABCDEF1',
            COMMIT_REF: '1234567890abcdef',
          },
        }),
      ),
    ).toBe('abcdef1');
  });

  it('skips empty and invalid supplied values', () => {
    const readGitSha = vi.fn(() => 'ABCDEF1234567');

    expect(
      resolveBuildVersion(
        options({
          env: { GITHUB_SHA: '', VITE_APP_VERSION: 'too-short', COMMIT_REF: 'not-a-sha' },
          readGitSha,
        }),
      ),
    ).toBe('abcdef1234567');
    expect(readGitSha).toHaveBeenCalledWith('/repo');
  });

  it('falls back to git rooted at the supplied repository', () => {
    const readGitSha = vi.fn(() => 'ABCDEF1234567890');

    expect(resolveBuildVersion(options({ readGitSha }))).toBe('abcdef1234567890');
    expect(readGitSha).toHaveBeenCalledWith('/repo');
  });

  it('returns an empty version for development and preview when no SHA exists', () => {
    expect(resolveBuildVersion(options({ environment: 'development' }))).toBe('');
    expect(resolveBuildVersion(options({ environment: 'preview' }))).toBe('');
  });

  it('throws when a production build has no valid SHA', () => {
    expect(() => resolveBuildVersion(options({ environment: 'production' }))).toThrow(
      'Production build requires a valid commit SHA.',
    );
  });
});
