import type posthog from 'posthog-js';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  sanitizePostHogEvent,
  sanitizeProperties,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from '../events';
import { AnalyticsContext, type AnalyticsConsent } from '../telemetry-context';
import './TelemetryProvider.module.css';

declare const __OPEN_KEYCHAIN_ENV__: 'development' | 'preview' | 'production';
declare const __OPEN_KEYCHAIN_VERSION__: string;
const BUILD_ENV: 'development' | 'preview' | 'production' =
  typeof __OPEN_KEYCHAIN_ENV__ === 'undefined'
    ? import.meta.env.DEV
      ? 'development'
      : 'preview'
    : __OPEN_KEYCHAIN_ENV__;
const BUILD_VERSION =
  typeof __OPEN_KEYCHAIN_VERSION__ === 'undefined' ? '' : __OPEN_KEYCHAIN_VERSION__;

const CONSENT_KEY = 'open-keychain.analytics-consent';
const INTERNAL_TRAFFIC_KEY = 'open-keychain.internal-traffic';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://cabinet.open-keychain.com';
type PostHogClient = typeof posthog;
let posthogClient: PostHogClient | undefined;
let posthogLoad: Promise<PostHogClient> | undefined;
let posthogInitStarted = false;
const MAX_PENDING_EVENTS = 100;
const pendingEvents: Array<{
  event: AnalyticsEvent;
  properties: Record<string, string | number | boolean>;
}> = [];

const flushPendingEvents = (): void => {
  if (
    captureConsent !== 'accepted' ||
    !posthogClient?.__loaded ||
    posthogClient.has_opted_out_capturing()
  ) {
    return;
  }
  for (const pending of pendingEvents.splice(0)) {
    try {
      posthogClient.capture(pending.event, pending.properties);
    } catch {
      continue;
    }
  }
};

const readConsent = (): AnalyticsConsent => {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'declined' ? value : 'unknown';
  } catch {
    return 'unknown';
  }
};

let captureConsent: AnalyticsConsent = readConsent();

const readInternalTraffic = (): boolean => {
  if (typeof window === 'undefined' || BUILD_ENV !== 'production')
    return BUILD_ENV !== 'production';
  try {
    return window.localStorage.getItem(INTERNAL_TRAFFIC_KEY) === 'true';
  } catch {
    return false;
  }
};

const syncPostHogConsent = (): void => {
  const client = posthogClient;
  if (!client?.__loaded) return;

  if (captureConsent === 'accepted') {
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    flushPendingEvents();
    return;
  }

  pendingEvents.length = 0;
  if (!client.has_opted_out_capturing()) {
    client.opt_out_capturing();
    client.reset();
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
  if (!POSTHOG_KEY) return;
  if (captureConsent !== 'accepted' || posthogClient?.__loaded || posthogInitStarted) {
    syncPostHogConsent();
    return;
  }
  try {
    const client = await loadPostHog();
    if (captureConsent !== 'accepted' || client.__loaded || posthogInitStarted) {
      syncPostHogConsent();
      return;
    }
    posthogInitStarted = true;
    client.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2026-05-30',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      capture_dead_clicks: false,
      capture_performance: false,
      logs: { captureConsoleLogs: false },
      save_campaign_params: false,
      save_referrer: false,
      disable_capture_url_hashes: true,
      before_send: sanitizePostHogEvent,
      loaded: () => {
        posthogInitStarted = false;
        syncPostHogConsent();
      },
      disable_session_recording: true,
      persistence: 'localStorage',
      disable_cookie: true,
    });
  } catch {
    posthogInitStarted = false;
    return;
  }
};

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsentState] = useState<AnalyticsConsent>(readConsent);

  useEffect(() => {
    if (consent === 'accepted') void configurePostHog();
  }, [consent]);

  const setConsent = useCallback((nextConsent: Exclude<AnalyticsConsent, 'unknown'>): void => {
    captureConsent = nextConsent;
    try {
      window.localStorage.setItem(CONSENT_KEY, nextConsent);
    } catch {
      // Apply this tab's choice even when the browser blocks local storage.
    }
    try {
      if (nextConsent === 'accepted') {
        void configurePostHog();
      } else {
        pendingEvents.length = 0;
        syncPostHogConsent();
      }
    } catch {
      if (nextConsent === 'declined') pendingEvents.length = 0;
    }
    setConsentState(nextConsent);
  }, []);

  const track = useCallback(
    (event: AnalyticsEvent, properties: AnalyticsProperties = {}): void => {
      if (consent !== 'accepted' || captureConsent !== 'accepted' || !POSTHOG_KEY) return;
      try {
        const safeProperties = sanitizeProperties(event, {
          ...properties,
          environment: BUILD_ENV,
          internal_traffic: readInternalTraffic(),
          app_version: /^[a-f0-9]{7,40}$/i.test(BUILD_VERSION)
            ? BUILD_VERSION.toLowerCase()
            : undefined,
        });
        if (!posthogClient?.__loaded || posthogClient.has_opted_out_capturing()) {
          if (pendingEvents.length < MAX_PENDING_EVENTS)
            pendingEvents.push({ event, properties: safeProperties });
          return;
        }
        posthogClient.capture(event, safeProperties);
      } catch {
        return;
      }
    },
    [consent],
  );

  const value = useMemo(() => ({ consent, setConsent, track }), [consent, setConsent, track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};
