import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnalyticsContext, type AnalyticsConsent } from './analytics-context';
import { sanitizeProperties, type AnalyticsEvent, type AnalyticsProperties } from './events';

const CONSENT_KEY = 'open-keychain.analytics-consent';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

const readConsent = (): AnalyticsConsent => {
  if (typeof window === 'undefined') return 'unknown';
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : 'unknown';
};

const configurePostHog = (): void => {
  if (!POSTHOG_KEY || posthog.__loaded) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    disable_cookie: true,
  });
};

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsentState] = useState<AnalyticsConsent>(readConsent);

  useEffect(() => {
    if (consent === 'accepted') configurePostHog();
  }, [consent]);

  const setConsent = useCallback((nextConsent: Exclude<AnalyticsConsent, 'unknown'>): void => {
    window.localStorage.setItem(CONSENT_KEY, nextConsent);
    if (nextConsent === 'accepted') {
      configurePostHog();
      posthog.opt_in_capturing();
    } else if (posthog.__loaded) {
      posthog.opt_out_capturing();
      posthog.reset();
    }
    setConsentState(nextConsent);
  }, []);

  const track = useCallback(
    (event: AnalyticsEvent, properties: AnalyticsProperties = {}): void => {
      if (consent !== 'accepted' || !POSTHOG_KEY || !posthog.__loaded) return;
      posthog.capture(event, sanitizeProperties(properties));
    },
    [consent],
  );

  const value = useMemo(() => ({ consent, setConsent, track }), [consent, setConsent, track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};
