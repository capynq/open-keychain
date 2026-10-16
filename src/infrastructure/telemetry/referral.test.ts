import { describe, expect, it } from 'vitest';

import { readPortfolioReferral } from './referral';

const campaign = '?utm_source=portfolio&utm_medium=referral&utm_campaign=projects';

describe('portfolio referral allowlist', () => {
  it('recognizes only the fixed campaign and ignores unrelated parameters', () => {
    expect(readPortfolioReferral(campaign)).toBe('portfolio');
    expect(readPortfolioReferral(`${campaign}&name=PRIVATE&gclid=private`)).toBe('portfolio');
  });

  it.each([
    '',
    '?utm_source=portfolio',
    '?utm_source=portfolio&utm_medium=referral',
    '?utm_source=private&utm_medium=referral&utm_campaign=projects',
    '?utm_source=portfolio&utm_medium=private&utm_campaign=projects',
    '?utm_source=portfolio&utm_medium=referral&utm_campaign=private',
    `${campaign}&utm_source=portfolio`,
    `${campaign}&utm_source=private`,
    `${campaign}&utm_medium=referral`,
    `${campaign}&utm_campaign=projects`,
  ])('rejects absent, unknown, partial, or ambiguous campaign: %s', (search) => {
    expect(readPortfolioReferral(search)).toBeUndefined();
  });
});
