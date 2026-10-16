export type AcquisitionSource = 'portfolio';

/** Recognize one fixed campaign; never return caller-supplied query values. */
export const readPortfolioReferral = (search: string): AcquisitionSource | undefined => {
  const params = new URLSearchParams(search);
  const campaign = {
    utm_source: 'portfolio',
    utm_medium: 'referral',
    utm_campaign: 'projects',
  };
  return Object.entries(campaign).every(([key, expected]) => {
    const values = params.getAll(key);
    return values.length === 1 && values[0] === expected;
  })
    ? 'portfolio'
    : undefined;
};
