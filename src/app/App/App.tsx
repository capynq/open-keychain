import { startTransition, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { detectInitialLocale, resolveAppSeoUrl, resolveDisplayLocale } from '@/features/seo';

import { type Locale } from '../../infrastructure/i18n/config';
import { setLocale } from '../../infrastructure/i18n/utils';
import './App.module.css';
import '../styles/app.css';
import { useAnalytics } from '../../infrastructure/telemetry/useTelemetry';
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner/AnalyticsConsentBanner';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary/RouteErrorBoundary';
import { useAppAnalytics } from '../hooks/useAppAnalytics';
import { useAppNavigationEffects } from '../hooks/useAppNavigationEffects';
import { useRoutePreload } from '../hooks/useRoutePreload';
import { CREATE_ROUTE, PROFILE_ROUTE } from '../routes';
import { AppSeoHead, useAppSeo } from '../seo/useAppSeo';
import { AppRoutes } from './AppRoutes';

type LocaleSetter = (value: Locale | ((previous: Locale) => Locale)) => void;

const createSeoCtaHandler =
  (
    track: ReturnType<typeof useAnalytics>['track'],
    currentLocale: Locale,
    setActiveLocale: LocaleSetter,
  ) =>
  (ctaLocale: Locale, cta: string): void => {
    track('seo_cta_clicked', { locale: ctaLocale, cta });
    if (ctaLocale === currentLocale) return;
    setActiveLocale(ctaLocale);
    void setLocale(ctaLocale);
  };

const App = () => {
  const [locale, setActiveLocale] = useState<Locale>(() =>
    detectInitialLocale(window.location.search, window.location.pathname),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;
  const isProfile = normalizedPath === PROFILE_ROUTE;
  const { consent, track } = useAnalytics();
  const appSeo = isCustomizer ? resolveAppSeoUrl(location.pathname, location.search) : undefined;
  const appSeoIndexable = appSeo?.indexable ?? false;
  const appSeoTemplate = appSeo?.template;
  const analyticsPath = appSeoTemplate
    ? `${normalizedPath}/template/${appSeoTemplate}`
    : normalizedPath;

  useAppNavigationEffects(location, locale);
  useRoutePreload();

  const displayLocale = resolveDisplayLocale(location, locale);

  useAppSeo({
    locale: displayLocale,
    pathname: location.pathname,
    search: location.search,
    normalizedPath,
    isCustomizer,
    isProfile,
  });

  useAppAnalytics({
    appSeoIndexable,
    appSeoTemplate,
    analyticsPath,
    consent,
    displayLocale,
    location,
    normalizedPath,
    track,
  });

  const onLocaleChange = (nextLocale: Locale): void => {
    track('language_changed', { from: displayLocale, to: nextLocale });
    if (isCustomizer) {
      const appSeo = resolveAppSeoUrl(location.pathname, location.search);
      if (appSeo.indexable) {
        const query = appSeo.template
          ? `?template=${appSeo.template}&lang=${nextLocale}`
          : `?lang=${nextLocale}`;

        startTransition(() => navigate(`/create${query}`, { replace: true }));
      }
    }
    setActiveLocale(nextLocale);
    void setLocale(nextLocale);
  };

  const onSeoCtaClick = createSeoCtaHandler(track, locale, setActiveLocale);
  const onSeoLocaleChange = (nextLocale: Locale): void => {
    track('seo_language_changed', { from: displayLocale, to: nextLocale });
    setActiveLocale(nextLocale);
    void setLocale(nextLocale);
  };

  return (
    <>
      <AppSeoHead
        locale={displayLocale}
        pathname={location.pathname}
        search={location.search}
        normalizedPath={normalizedPath}
        isCustomizer={isCustomizer}
        isProfile={isProfile}
      />
      <RouteErrorBoundary
        locale={displayLocale}
        resetKey={`${location.pathname}${location.search}${location.hash}`}
      >
        <AppRoutes
          location={location}
          normalizedPath={normalizedPath}
          displayLocale={displayLocale}
          onLocaleChange={onLocaleChange}
          onSeoCtaClick={onSeoCtaClick}
          onSeoLocaleChange={onSeoLocaleChange}
        />
      </RouteErrorBoundary>
      <AnalyticsConsentBanner locale={displayLocale} />
    </>
  );
};

export default App;
