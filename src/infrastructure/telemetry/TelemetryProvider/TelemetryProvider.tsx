import type posthog from 'posthog-js';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  sanitizePostHogEvent,
  sanitizeProperties,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from '../events';
import { registerReactExceptionCapture } from '../react-exceptions';
import { readPortfolioReferral, type AcquisitionSource } from '../referral';
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
const pendingExceptions: Error[] = [];
const startHighSignalRecording = (): void => {
  if (
    captureConsent === 'accepted' &&
    posthogClient?.__loaded &&
    !posthogClient.has_opted_out_capturing()
  ) {
    posthogClient.startSessionRecording({ sampling: true });
  }
};

const capturePendingEvent = (
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean>,
): void => {
  if (event === 'export_failed') startHighSignalRecording();
  posthogClient?.capture(event, properties);
};
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
      capturePendingEvent(pending.event, pending.properties);
    } catch {
      continue;
    }
  }
  for (const error of pendingExceptions.splice(0)) {
    try {
      startHighSignalRecording();
      posthogClient.captureException(error, { error_boundary: 'route' });
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
const REFERRAL_KEY = 'open-keychain.acquisition-source';

const readAcquisitionSource = (): AcquisitionSource | undefined => {
  if (typeof window === 'undefined' || captureConsent === 'declined') return undefined;
  const source = readPortfolioReferral(window.location.search);
  if (source || captureConsent !== 'accepted') return source;
  try {
    return window.sessionStorage.getItem(REFERRAL_KEY) === 'portfolio' ? 'portfolio' : undefined;
  } catch {
    return undefined;
  }
};

// Before consent, retain only the fixed marker in memory across SPA navigation.
let acquisitionSource = readAcquisitionSource();

const syncReferralConsent = (): void => {
  if (captureConsent === 'declined') acquisitionSource = undefined;
  try {
    if (captureConsent === 'accepted' && acquisitionSource === 'portfolio') {
      window.sessionStorage.setItem(REFERRAL_KEY, 'portfolio');
    } else {
      window.sessionStorage.removeItem(REFERRAL_KEY);
    }
  } catch {
    // Tracking can still use the in-memory marker when session storage is blocked.
  }
};

const readInternalTraffic = (): boolean => {
  if (typeof window === 'undefined' || BUILD_ENV !== 'production')
    return BUILD_ENV !== 'production';
  try {
    return window.localStorage.getItem(INTERNAL_TRAFFIC_KEY) === 'true';
  } catch {
    return false;
  }
};

const sanitizeAndTagPostHogEvent = (event: Parameters<typeof sanitizePostHogEvent>[0]) => {
  const sanitized = sanitizePostHogEvent(event);
  if (!sanitized?.properties) return sanitized;
  return {
    ...sanitized,
    properties: {
      ...sanitized.properties,
      environment: BUILD_ENV,
      internal_traffic: readInternalTraffic(),
      ...(/^[a-f0-9]{7,40}$/i.test(BUILD_VERSION)
        ? { app_version: BUILD_VERSION.toLowerCase() }
        : {}),
    },
  };
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
  pendingExceptions.length = 0;
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
      autocapture: true,
      capture_dead_clicks: true,
      capture_performance: true,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      logs: { captureConsoleLogs: true },
      save_campaign_params: false,
      save_referrer: false,
      disable_capture_url_hashes: true,
      before_send: sanitizeAndTagPostHogEvent,
      loaded: () => {
        posthogInitStarted = false;
        syncPostHogConsent();
      },
      disable_session_recording: false,
      session_recording: {
        sampleRate: 1,
        maskAllInputs: false,
        captureCanvas: { recordCanvas: true },
        canvasCapture: { resolutionScale: 0.6 },
      },
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
    syncReferralConsent();
    if (consent === 'accepted') void configurePostHog();
  }, [consent]);

  useEffect(() => {
    const handleConsentStorage = (event: StorageEvent): void => {
      if (event.key !== CONSENT_KEY) return;
      const nextConsent: AnalyticsConsent =
        event.newValue === 'accepted' || event.newValue === 'declined' ? event.newValue : 'unknown';
      captureConsent = nextConsent;
      syncReferralConsent();
      if (nextConsent !== 'accepted') {
        pendingEvents.length = 0;
        pendingExceptions.length = 0;
        syncPostHogConsent();
      } else {
        void configurePostHog();
      }
      setConsentState(nextConsent);
    };
    window.addEventListener('storage', handleConsentStorage);
    return () => window.removeEventListener('storage', handleConsentStorage);
  }, []);

  const setConsent = useCallback((nextConsent: Exclude<AnalyticsConsent, 'unknown'>): void => {
    captureConsent = nextConsent;
    syncReferralConsent();
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
        pendingExceptions.length = 0;
        syncPostHogConsent();
      }
    } catch {
      if (nextConsent === 'declined') {
        pendingEvents.length = 0;
        pendingExceptions.length = 0;
      }
    }
    setConsentState(nextConsent);
  }, []);

  const track = useCallback(
    (event: AnalyticsEvent, properties: AnalyticsProperties = {}): void => {
      if (consent !== 'accepted' || captureConsent !== 'accepted' || !POSTHOG_KEY) return;
      try {
        const safeProperties = sanitizeProperties(event, {
          ...properties,
          acquisition_source: acquisitionSource,
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
        capturePendingEvent(event, safeProperties);
      } catch {
        return;
      }
    },
    [consent],
  );

  const value = useMemo(() => ({ consent, setConsent, track }), [consent, setConsent, track]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
};

/** Send a React boundary exception only after consent and include only fixed context. */
const sendReactException = (error: Error): void => {
  if (captureConsent !== 'accepted' || !POSTHOG_KEY) return;
  try {
    if (!posthogClient?.__loaded) {
      if (pendingExceptions.length < MAX_PENDING_EVENTS) pendingExceptions.push(error);
      return;
    }
    if (posthogClient.has_opted_out_capturing()) return;
    startHighSignalRecording();
    posthogClient.captureException(error, { error_boundary: 'route' });
  } catch {
    return;
  }
};

registerReactExceptionCapture(sendReactException);
