import { describe, expect, it } from 'vitest';
import { quotaAvailable, quotaPolicyFor } from './quotas';

describe('hosted export quotas', () => {
  it('allows the default anonymous weekly allowance', () => {
    const policy = quotaPolicyFor('free');
    expect(quotaAvailable(policy, { weekly: 2, daily: 2, minute: 1 })).toBe(true);
    expect(quotaAvailable(policy, { weekly: 3, daily: 0, minute: 0 })).toBe(false);
  });

  it('keeps paid users bounded by daily and minute safety limits', () => {
    const policy = quotaPolicyFor('maker');
    expect(quotaAvailable(policy, { weekly: 500, daily: 199, minute: 5 })).toBe(true);
    expect(quotaAvailable(policy, { weekly: 500, daily: 200, minute: 0 })).toBe(false);
    expect(quotaAvailable(policy, { weekly: 500, daily: 1, minute: 6 })).toBe(false);
  });
});
