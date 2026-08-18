import { useContext } from 'react';
import { AnalyticsContext } from './analytics-context';
import type { AnalyticsContextValue } from './analytics-context';

export const useAnalytics = (): AnalyticsContextValue => {
  const value = useContext(AnalyticsContext);
  if (!value) throw new Error('useAnalytics must be used inside AnalyticsProvider');
  return value;
};
