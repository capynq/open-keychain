import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type posthog from 'posthog-js';
import { AnalyticsContext, type AnalyticsConsent } from './telemetry-context';
import { sanitizeProperties, type AnalyticsEvent, type AnalyticsProperties } from './events';

const CONSENT_KEY = 'open-keychain.analytics-consent';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';
type PostHogClient = typeof posthog;
let posthogClient: PostHogClient | undefined;
let posthogLoad: Promise<PostHogClient> | undefined;

const readConsent = (): AnalyticsConsent => {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'declined' ? value : 'unknown';
  } catch {
    return 'unknown';
  }
};

const loadPostHog = (): Promise<PostHogClient> => {
  if (!posthogLoad) {
    posthogLoad = import('posthog-js')
      .then(({ default: client }) => {
        posthogClient = client;
        return client;
      })
      .catch((error: unknown) => {
        posthogLoad = undefined;
        throw error;
      });
  }
  return posthogLoad;
};

const configurePostHog = async (): Promise<void> => {
  if (!POSTHOG_KEY || posthogClient?.__loaded) return;
  try {
    const client = await loadPostHog();
    if (client.__loaded) return;
    client.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'localStorage',
      disable_cookie: true,
    });
  } catch {
    return;
  }
};

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsentState] = useState<AnalyticsConsent>(readConsent);

  useEffect(() => {
    if (consent === 'accepted') void configurePostHog();
  }, [consent]);

  const setConsent = useCallback((nextConsent: Exclude<AnalyticsConsent, 'unknown'>): void => {
    try {
      window.localStorage.setItem(CONSENT_KEY, nextConsent);
    } catch {
      return setConsentState(nextConsent);
    }
    try {
      if (nextConsent === 'accepted') {
        void configurePostHog().then(() => {
          if (posthogClient?.__loaded) posthogClient.opt_in_capturing();
        });
      } else if (posthogClient?.__loaded) {
        posthogClient.opt_out_capturing();
        posthogClient.reset();
      }
    } catch {
      return setConsentState(nextConsent);
    }
    setConsentState(nextConsent);
  }, []);

  const track = useCallback(
    (event: AnalyticsEvent, properties: AnalyticsProperties = {}): void => {
      if (consent !== 'accepted' || !POSTHOG_KEY || !posthogClient?.__loaded) return;
      try {
        posthogClient.capture(event, sanitizeProperties(properties));
      } catch {
        return;
      }
    },
    [consent],
  );

  const value = useMemo(() => ({ consent, setConsent, track }), [consent, setConsent, track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};
