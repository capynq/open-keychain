import { useContext } from 'react';
import { AnalyticsContext } from './telemetry-context';
import type { AnalyticsContextValue } from './telemetry-context';

export const useAnalytics = (): AnalyticsContextValue => {
  const value = useContext(AnalyticsContext);
  if (!value) throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
};
