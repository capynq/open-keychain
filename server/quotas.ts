export type QuotaPolicy = {
  weeklyExports: number;
  dailyExports: number;
  minuteExports: number;
};
export type QuotaWindow = {
  weekly: number;
  daily: number;
  minute: number;
};
export const quotaAvailable = (policy: QuotaPolicy, usage: QuotaWindow): boolean => {
  return (
    usage.weekly < policy.weeklyExports &&
    usage.daily < policy.dailyExports &&
    usage.minute < policy.minuteExports
  );
};
export const quotaPolicyFor = (plan: 'free' | 'maker'): QuotaPolicy => {
  if (plan === 'maker')
    return { weeklyExports: Number.MAX_SAFE_INTEGER, dailyExports: 200, minuteExports: 6 };
  return { weeklyExports: 3, dailyExports: 3, minuteExports: 2 };
};
