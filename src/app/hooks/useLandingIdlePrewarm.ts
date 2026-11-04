import { useEffect } from 'react';

import { resolveSeoRoute } from '@/features/seo';

import { LANDING_ROUTE } from '../routes';
import { loadAndPrewarm } from '../routing/geometryPrewarm';

const IDLE_TIMEOUT_MS = 4000;
const FALLBACK_DELAY_MS = 1500;
const LCP_QUIET_MS = 1000;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

const isLandingPath = (pathname: string): boolean => {
  if (pathname.replace(/\/+$/, '') === LANDING_ROUTE) return true;
  return resolveSeoRoute(pathname)?.kind === 'home';
};

const isConstrainedConnection = (): boolean => {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

  return (
    connection?.saveData === true ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  );
};

const scheduleIdle = (run: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });

    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, FALLBACK_DELAY_MS);

  return () => window.clearTimeout(id);
};

const onceLcpSettles = (run: () => void): (() => void) => {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')
  ) {
    run();

    return () => undefined;
  }

  let quiet: ReturnType<typeof setTimeout> | undefined;
  const observer = new PerformanceObserver(() => {
    clearTimeout(quiet);
    quiet = setTimeout(() => {
      observer.disconnect();
      run();
    }, LCP_QUIET_MS);
  });

  observer.observe({ type: 'largest-contentful-paint', buffered: true });

  return () => {
    observer.disconnect();
    clearTimeout(quiet);
  };
};

export const useLandingIdlePrewarm = (pathname: string): void => {
  const onLanding = isLandingPath(pathname);

  useEffect(() => {
    if (!onLanding) return undefined;

    let cancelIdle: (() => void) | undefined;
    let cancelLcp: (() => void) | undefined;
    const onReady = (): void => {
      cancelLcp = onceLcpSettles(() => {
        cancelIdle = scheduleIdle(() => {
          if (!isConstrainedConnection())
            loadAndPrewarm(() => isLandingPath(window.location.pathname));
        });
      });
    };

    if (document.readyState === 'complete') {
      onReady();
    } else {
      window.addEventListener('load', onReady, { once: true });
    }

    return () => {
      window.removeEventListener('load', onReady);
      cancelLcp?.();
      cancelIdle?.();
    };
  }, [onLanding]);
};
