import { describe, expect, it, vi } from 'vitest';

import {
  resolveBuildEnvironment,
  resolveBuildRelease,
  resolveBuildVersion,
} from './build-version.ts';

const options = (overrides: Partial<Parameters<typeof resolveBuildVersion>[0]> = {}) => ({
  env: {},
  environment: 'preview' as const,
  repoRoot: '/repo',
  readGitSha: vi.fn(() => undefined),
  ...overrides,
});

describe('resolveBuildVersion', () => {
  it('uses the first valid full SHA in precedence order and normalizes it', () => {
    const explicitVersion = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
    expect(
      resolveBuildVersion(
        options({
          env: {
            GITHUB_SHA: '1'.repeat(40),
            VITE_APP_VERSION: explicitVersion,
            COMMIT_REF: '2'.repeat(40),
          },
        }),
      ),
    ).toBe(explicitVersion.toLowerCase());
  });

  it('skips empty and invalid supplied values', () => {
    const readGitSha = vi.fn(() => 'A'.repeat(40));

    expect(
      resolveBuildVersion(
        options({
          env: {
            GITHUB_SHA: 'b'.repeat(40),
            VITE_APP_VERSION: 'too-short',
            COMMIT_REF: 'not-a-sha',
          },
          readGitSha,
        }),
      ),
    ).toBe('b'.repeat(40));
    expect(readGitSha).not.toHaveBeenCalled();
  });

  it('falls back to git rooted at the supplied repository', () => {
    const readGitSha = vi.fn(() => 'A'.repeat(40));

    expect(resolveBuildVersion(options({ readGitSha }))).toBe('a'.repeat(40));
    expect(readGitSha).toHaveBeenCalledWith('/repo');
  });

  it('allows a local development version without Git metadata only when explicitly requested', () => {
    expect(resolveBuildVersion(options({ environment: 'development' }))).toBe('');
    expect(
      resolveBuildVersion(
        options({ environment: 'development', env: { VITE_APP_VERSION: 'local' } }),
      ),
    ).toBe('local');
  });

  it.each(['production', 'preview'] as const)(
    'throws when a %s build has no full SHA',
    (environment) => {
      expect(() => resolveBuildVersion(options({ environment }))).toThrow(
        'Non-development build requires a full 40-character commit SHA.',
      );
    },
  );

  it('accepts an explicit full SHA when Git metadata is absent', () => {
    expect(
      resolveBuildVersion(
        options({
          environment: 'production',
          env: { VITE_APP_VERSION: 'f'.repeat(40) },
        }),
      ),
    ).toBe('f'.repeat(40));
  });
});

describe('resolveBuildEnvironment', () => {
  it.each([
    [{ NODE_ENV: 'development' }, 'development'],
    [{ NODE_ENV: 'production' }, 'production'],
    [{ CONTEXT: 'production', NODE_ENV: 'development' }, 'production'],
    [{ CONTEXT: 'deploy-preview', NODE_ENV: 'production' }, 'preview'],
    [{ NODE_ENV: 'test' }, 'preview'],
  ] as const)('classifies %o as %s', (env, expected) => {
    expect(resolveBuildEnvironment(env)).toBe(expected);
  });
});

describe('resolveBuildRelease', () => {
  const packageVersion = '0.1.0-beta.1';

  it('combines the package version with the full source SHA', () => {
    expect(resolveBuildRelease(packageVersion, 'a'.repeat(40))).toBe(
      `0.1.0-beta.1+${'a'.repeat(40)}`,
    );
  });

  it('is stable for retries of one commit and changes for another commit', () => {
    const release = resolveBuildRelease(packageVersion, 'a'.repeat(40));
    expect(resolveBuildRelease(packageVersion, 'a'.repeat(40))).toBe(release);
    expect(resolveBuildRelease(packageVersion, 'b'.repeat(40))).not.toBe(release);
  });

  it('changes when the package version changes and uses local for a development build without Git', () => {
    expect(resolveBuildRelease('0.2.0', 'a'.repeat(40))).toBe(`0.2.0+${'a'.repeat(40)}`);
    expect(resolveBuildRelease(packageVersion, '')).toBe('0.1.0-beta.1+local');
  });

  it('rejects unsafe package versions', () => {
    expect(() => resolveBuildRelease('bad version', 'a'.repeat(40))).toThrow(
      'package.json version and app version must form a safe release label.',
    );
  });

  it('rejects an abbreviated or malformed source version', () => {
    expect(() => resolveBuildRelease(packageVersion, 'abcdef1')).toThrow(
      'A frontend release requires a full 40-character commit SHA or local version.',
    );
  });
});
