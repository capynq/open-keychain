import { describe, expect, it } from 'vitest';

import { estimateLaborSavings } from './labor-savings';

describe('estimateLaborSavings', () => {
  it('computes a planning opportunity value from user-entered handling time', () => {
    expect(
      estimateLaborSavings({
        orderCount: 12,
        manualMinutesPerOrder: 8,
        activeHandlingMinutes: 3,
        hourlyValue: 24,
      }),
    ).toEqual({ savedMinutes: 93, estimatedOpportunityValue: 37.2 });
  });

  it('never turns invalid or negative inputs into an asserted gain', () => {
    expect(
      estimateLaborSavings({
        orderCount: 2,
        manualMinutesPerOrder: 2,
        activeHandlingMinutes: 5,
        hourlyValue: Number.NaN,
      }),
    ).toEqual({ savedMinutes: 0, estimatedOpportunityValue: 0 });
  });
});
