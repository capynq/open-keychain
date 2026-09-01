import { useEffect } from 'react';
import type { Location } from 'react-router';
import { resolveSeoRoute } from '../../infrastructure/seo/catalog';
import type { useAnalytics } from '../../infrastructure/telemetry';
import type { Locale } from '../../infrastructure/i18n';

type AnalyticsTrack = ReturnType<typeof useAnalytics>['track'];

export type AppPageAnalyticsOptions = {
  appSeoIndexable: boolean;
  appSeoTemplate?: string;
  analyticsPath: string;
  consent: ReturnType<typeof useAnalytics>['consent'];
  displayLocale: Locale;
  location: Location;
  normalizedPath: string;
  track: AnalyticsTrack;
};

/** Records navigation events for app routes and the localized SEO catalog. */
export const useAppAnalytics = ({
  appSeoIndexable,
  appSeoTemplate,
  analyticsPath,
  consent,
  displayLocale,
  location,
  normalizedPath,
  track,
}: AppPageAnalyticsOptions): void => {
  useEffect(() => {
    track(normalizedPath === '/' ? 'landing_view' : 'page_view', {
      locale: displayLocale,
      path: analyticsPath,
    });

    const seoRoute = resolveSeoRoute(location.pathname);
    if (!seoRoute && !appSeoIndexable) return;

    track('seo_page_view', {
      locale: displayLocale,
      page_type: appSeoIndexable ? 'app' : seoRoute?.kind,
      page_id:
        appSeoTemplate ??
        (seoRoute && 'templateId' in seoRoute
          ? seoRoute.templateId
          : seoRoute && 'guideSlug' in seoRoute
            ? seoRoute.guideSlug
            : (seoRoute?.kind ?? 'create')),
    });
  }, [
    analyticsPath,
    appSeoIndexable,
    appSeoTemplate,
    consent,
    displayLocale,
    location.pathname,
    normalizedPath,
    track,
  ]);
};
