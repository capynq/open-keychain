import { useContext } from 'react';

import type { AnalyticsContextValue } from './telemetry-context';

import { AnalyticsContext } from './telemetry-context';

export const useAnalytics = (): AnalyticsContextValue => {
  const value = useContext(AnalyticsContext);
  if (!value) throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
};
