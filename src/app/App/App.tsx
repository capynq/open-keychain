import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';

import {
  detectInitialLocale,
  resolveAppSeoUrl,
  resolveDisplayLocale,
  resolveSeoRoute,
} from '@/features/seo';
import { SeoPage } from '@/pages/seo/SeoPage';

import { hostedMode } from '../../features/hosted/config';
import { type Locale } from '../../infrastructure/i18n/config';
import { setLocale } from '../../infrastructure/i18n/utils';
import './App.module.css';
import '../styles/app.css';
import '../styles/landing.css';
import { useAnalytics } from '../../infrastructure/telemetry/useTelemetry';
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner/AnalyticsConsentBanner';
import { RouteLoading } from '../components/RouteLoading/RouteLoading';
import { useAppAnalytics } from '../hooks/useAppAnalytics';
import { useAppNavigationEffects } from '../hooks/useAppNavigationEffects';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from '../routes';
import { AppSeoHead, useAppSeo } from '../seo/useAppSeo';

const LandingPage = lazy(() =>
  import('@/pages/landing/LandingPage').then(({ LandingPage: page }) => ({ default: page })),
);
const CustomizerPage = lazy(() =>
  import('@/pages/customizer/CustomizerPage').then(({ CustomizerPage: page }) => ({
    default: page,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/profile/ProfilePage').then(({ ProfilePage: page }) => ({ default: page })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/seo/PrivacyPage').then(({ PrivacyPage: page }) => ({ default: page })),
);
const SeoNotFoundPage = lazy(() =>
  import('@/pages/seo/SeoNotFoundPage').then(({ SeoNotFoundPage: page }) => ({ default: page })),
);

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

        navigate(`/create${query}`, { replace: true });
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
      <Suspense fallback={<RouteLoading locale={displayLocale} />}>
        <Routes>
          <Route
            path={LANDING_ROUTE}
            element={<LandingPage locale={displayLocale} onLocaleChange={onLocaleChange} />}
          />
          <Route
            path={CREATE_ROUTE}
            element={<CustomizerPage locale={displayLocale} onLocaleChange={onLocaleChange} />}
          />
          <Route
            path={PROFILE_ROUTE}
            element={
              hostedMode ? (
                <ProfilePage locale={displayLocale} onLocaleChange={onLocaleChange} />
              ) : (
                <Navigate to={LANDING_ROUTE} replace />
              )
            }
          />
          <Route
            path="*"
            element={(() => {
              const seoRoute = resolveSeoRoute(location.pathname);

              if (normalizedPath === '/privacy') {
                return <PrivacyPage locale={displayLocale} onLocaleChange={onSeoLocaleChange} />;
              }

              return seoRoute ? (
                <SeoPage
                  route={
                    seoRoute.kind === 'home' && seoRoute.path === '/'
                      ? { ...seoRoute, locale: displayLocale }
                      : seoRoute
                  }
                  onCtaClick={onSeoCtaClick}
                  onLocaleChange={onSeoLocaleChange}
                />
              ) : (
                <SeoNotFoundPage locale={displayLocale} />
              );
            })()}
          />
        </Routes>
      </Suspense>
      <AnalyticsConsentBanner locale={displayLocale} />
    </>
  );
};

export default App;
