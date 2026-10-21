import { execFileSync } from 'node:child_process';

export type BuildEnvironment = 'development' | 'preview' | 'production';

export type BuildVersionOptions = {
  env?: NodeJS.ProcessEnv;
  environment: BuildEnvironment;
  repoRoot: string;
  readGitSha?: (repoRoot: string) => string | undefined;
};

export const resolveBuildEnvironment = (env: NodeJS.ProcessEnv = process.env): BuildEnvironment => {
  if (env.CONTEXT === 'production') return 'production';
  if (env.CONTEXT) return 'preview';
  if (env.NODE_ENV === 'development') return 'development';
  if (env.NODE_ENV === 'production') return 'production';
  return 'preview';
};

const RELEASE_PATTERN = /^[a-z0-9][a-z0-9._+-]{0,127}$/i;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export const resolveBuildRelease = (packageVersion: string, appVersion: string): string => {
  const sourceVersion = appVersion || 'local';
  if (sourceVersion !== 'local' && !SHA_PATTERN.test(sourceVersion)) {
    throw new Error('A frontend release requires a full 40-character commit SHA or local version.');
  }

  const release = `${packageVersion}+${sourceVersion}`;
  if (!RELEASE_PATTERN.test(release)) {
    throw new Error('package.json version and app version must form a safe release label.');
  }
  return release;
};

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
  const suppliedSha = [env.VITE_APP_VERSION, env.COMMIT_REF, env.GITHUB_SHA].find(isValidSha);
  if (suppliedSha) return suppliedSha.trim().toLowerCase();

  const gitSha = readGitShaOverride(repoRoot);
  if (isValidSha(gitSha)) return gitSha.trim().toLowerCase();

  if (environment !== 'development') {
    throw new Error('Non-development build requires a full 40-character commit SHA.');
  }

  if (env.VITE_APP_VERSION?.trim().toLowerCase() === 'local') return 'local';
  return '';
};
