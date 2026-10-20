import { execFileSync } from 'node:child_process';

export type BuildEnvironment = 'development' | 'preview' | 'production';

export type BuildVersionOptions = {
  env?: NodeJS.ProcessEnv;
  environment: BuildEnvironment;
  repoRoot: string;
  readGitSha?: (repoRoot: string) => string | undefined;
};

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

const isValidSha = (value: string | undefined): value is string =>
  value !== undefined && SHA_PATTERN.test(value.trim());

const readGitSha = (repoRoot: string): string | undefined => {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
};

export const resolveBuildVersion = ({
  env = process.env,
  environment,
  repoRoot,
  readGitSha: readGitShaOverride = readGitSha,
}: BuildVersionOptions): string => {
  const suppliedSha = [env.GITHUB_SHA, env.VITE_APP_VERSION, env.COMMIT_REF].find(isValidSha);
  if (suppliedSha) return suppliedSha.trim().toLowerCase();

  const gitSha = readGitShaOverride(repoRoot);
  if (isValidSha(gitSha)) return gitSha.trim().toLowerCase();

  if (environment === 'production') {
    throw new Error('Production build requires a valid commit SHA.');
  }

  return '';
};
