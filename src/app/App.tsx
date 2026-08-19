import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAnalytics } from '../infrastructure/telemetry';
import { detectLocale, setLocale, supportedLocales, t, type Locale } from '../infrastructure/i18n';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from './routes';
import { hostedMode } from '../features/hosted/config';
import './styles/app.css';
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then(({ LandingPage: page }) => ({ default: page })),
);
const CustomizerPage = lazy(() =>
  import('./pages/CustomizerPage').then(({ CustomizerPage: page }) => ({ default: page })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then(({ ProfilePage: page }) => ({ default: page })),
);

const SITE_URL = 'https://open-keychain.com';

const localeFromSearch = (search: string): Locale | undefined => {
  const requestedLocale = new URLSearchParams(search).get('lang');

  return requestedLocale && supportedLocales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : undefined;
};

const setMetaContent = (selector: string, content: string): void => {
  const meta = document.querySelector<HTMLMetaElement>(selector);
  if (meta) meta.content = content;
};

const RouteLoading = ({ locale }: { locale: Locale }) => (
  <div className="route-loading" role="status" aria-live="polite">
    {t(locale, 'fontLoading')}
  </div>
);

const App = () => {
  const [locale, setActiveLocale] = useState<Locale>(
    () => localeFromSearch(window.location.search) ?? detectLocale(),
  );
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;
  const isProfile = normalizedPath === PROFILE_ROUTE;
  const { consent, track } = useAnalytics();

  useEffect(() => {
    void setLocale(locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    const titleKey = isProfile
      ? 'documentProfileTitle'
      : isCustomizer
        ? 'documentCreateTitle'
        : 'documentLandingTitle';
    const descriptionKey = isProfile
      ? 'metaProfileDescription'
      : isCustomizer
        ? 'metaCreateDescription'
        : 'metaLandingDescription';
    const title = t(locale, titleKey);
    const description = t(locale, descriptionKey);
    const canonicalPath = normalizedPath === '/' ? '/' : normalizedPath;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    document.title = title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
    setMetaContent('meta[name="description"]', description);
    setMetaContent(
      'meta[name="robots"]',
      isCustomizer || isProfile ? 'noindex,follow' : 'index,follow',
    );
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
  }, [isCustomizer, isProfile, locale, normalizedPath]);

  useEffect(() => {
    track(normalizedPath === '/' ? 'landing_view' : 'page_view', {
      locale,
      path: normalizedPath,
    });
  }, [consent, isCustomizer, locale, normalizedPath, track]);

  const onLocaleChange = (nextLocale: Locale): void => {
    track('language_changed', { from: locale, to: nextLocale });
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
