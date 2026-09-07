export type LaborSavingsInputs = {
  orderCount: number;
  manualMinutesPerOrder: number;
  activeHandlingMinutes: number;
  hourlyValue: number;
};

export type LaborSavingsEstimate = {
  savedMinutes: number;
  estimatedOpportunityValue: number;
};

const nonNegativeFinite = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/** A local planning estimate, never an assertion of observed savings or revenue. */
export const estimateLaborSavings = ({
  orderCount,
  manualMinutesPerOrder,
  activeHandlingMinutes,
  hourlyValue,
}: LaborSavingsInputs): LaborSavingsEstimate => {
  const orders = Math.floor(nonNegativeFinite(orderCount));
  const savedMinutes = Math.max(
    0,
    orders * nonNegativeFinite(manualMinutesPerOrder) - nonNegativeFinite(activeHandlingMinutes),
  );
  return {
    savedMinutes,
    estimatedOpportunityValue: (savedMinutes / 60) * nonNegativeFinite(hourlyValue),
  };
};
