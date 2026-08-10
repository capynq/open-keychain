export type ServerConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  authSecret: string;
  appUrl: string;
  anonymousWeeklyExports: number;
  paidDailyExports: number;
  paidMinuteExports: number;
};
const numberEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
export const serverConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const databaseUrl = env.DATABASE_URL;
  const authSecret = env.BETTER_AUTH_SECRET;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to start the hosted API.');
  if (!authSecret || authSecret.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  return {
    port: numberEnv(env.PORT, 3000),
    host: env.HOST ?? '127.0.0.1',
    databaseUrl,
    authSecret,
    appUrl: env.APP_URL ?? 'http://localhost:5173',
    anonymousWeeklyExports: Math.min(3, numberEnv(env.ANONYMOUS_WEEKLY_EXPORTS, 3)),
    paidDailyExports: numberEnv(env.PAID_DAILY_EXPORTS, 200),
    paidMinuteExports: numberEnv(env.PAID_MINUTE_EXPORTS, 6),
  };
};
