import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useAnalytics } from '../../infrastructure/telemetry';
import { setLocale, t, type Locale } from '../../infrastructure/i18n';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from '../routes';
import { hostedMode } from '../../features/hosted/config';
import './App.module.css';
import '../styles/app.css';
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner/AnalyticsConsentBanner';
import { detectInitialLocale, useAppSeo } from '../seo/useAppSeo';
import { resolveAppSeoUrl } from '../../infrastructure/seo/app-metadata';

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

const RouteLoading = ({ locale }: { locale: Locale }) => (
  <div className="route-loading" role="status" aria-live="polite">
    {t(locale, 'fontLoading')}
  </div>
);

const App = () => {
  const [locale, setActiveLocale] = useState<Locale>(() =>
    detectInitialLocale(window.location.search),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;
  const isProfile = normalizedPath === PROFILE_ROUTE;
  const { consent, track } = useAnalytics();

  useEffect(() => {
    void setLocale(locale);
  }, [locale]);

  useAppSeo({
    locale,
    pathname: location.pathname,
    search: location.search,
    normalizedPath,
    isCustomizer,
    isProfile,
  });

  useEffect(() => {
    track(normalizedPath === '/' ? 'landing_view' : 'page_view', {
      locale,
      path: normalizedPath,
    });
  }, [consent, isCustomizer, locale, normalizedPath, track]);

  const onLocaleChange = (nextLocale: Locale): void => {
    track('language_changed', { from: locale, to: nextLocale });
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

  return (
    <>
      <Suspense fallback={<RouteLoading locale={locale} />}>
        <Routes>
          <Route
            path={LANDING_ROUTE}
            element={<LandingPage locale={locale} onLocaleChange={onLocaleChange} />}
          />
          <Route
            path={CREATE_ROUTE}
            element={<CustomizerPage locale={locale} onLocaleChange={onLocaleChange} />}
          />
          <Route
            path={PROFILE_ROUTE}
            element={
              hostedMode ? (
                <ProfilePage locale={locale} onLocaleChange={onLocaleChange} />
              ) : (
                <Navigate to={LANDING_ROUTE} replace />
              )
            }
          />
          <Route path="*" element={<Navigate to={LANDING_ROUTE} replace />} />
        </Routes>
      </Suspense>
      <AnalyticsConsentBanner locale={locale} />
    </>
  );
};

export default App;
