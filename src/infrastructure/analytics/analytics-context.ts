import { createContext } from 'react';
import type { AnalyticsEvent, AnalyticsProperties } from './events';

export type AnalyticsConsent = 'unknown' | 'accepted' | 'declined';

export type AnalyticsContextValue = {
  consent: AnalyticsConsent;
  setConsent: (consent: Exclude<AnalyticsConsent, 'unknown'>) => void;
  track: (event: AnalyticsEvent, properties?: AnalyticsProperties) => void;
};

export const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);
