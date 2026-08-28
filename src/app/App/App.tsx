import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useAnalytics } from '../../infrastructure/telemetry';
import {
  detectLocale,
  setLocale,
  supportedLocales,
  t,
  type Locale,
} from '../../infrastructure/i18n';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from '../routes';
import { hostedMode } from '../../features/hosted/config';
import './App.module.css';
import '../styles/app.css';
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner/AnalyticsConsentBanner';
import {
  appSeoCanonical,
  appSeoCopy,
  resolveAppSeoUrl,
} from '../../infrastructure/seo/app-metadata';

const LandingPage = lazy(() =>
  import('../pages/LandingPage/LandingPage').then(({ LandingPage: page }) => ({ default: page })),
);
const CustomizerPage = lazy(() =>
  import('../pages/CustomizerPage/CustomizerPage').then(({ CustomizerPage: page }) => ({
    default: page,
  })),
);
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage/ProfilePage').then(({ ProfilePage: page }) => ({ default: page })),
);

const SITE_URL = 'https://open-keychain.com';
const STATIC_JSON_LD =
  typeof document === 'undefined'
    ? ''
    : (document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
        ?.textContent ?? '');

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

const restoreStaticAlternates = (): void => {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((link) => link.remove());
  for (const [hreflang, path] of [
    ['en', '/'],
    ['ru', '/ru/'],
    ['uk', '/uk/'],
    ['x-default', '/'],
  ] as const) {
    const link = document.createElement('link');

    link.rel = 'alternate';
    link.hreflang = hreflang;
    link.href = `${SITE_URL}${path}`;
    document.head.append(link);
  }
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
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;
  const isProfile = normalizedPath === PROFILE_ROUTE;
  const { consent, track } = useAnalytics();

  useEffect(() => {
    void setLocale(locale);
  }, [locale]);

  useEffect(() => {
    const appSeo = isCustomizer
      ? resolveAppSeoUrl(location.pathname, location.search)
      : { indexable: false, locale };
    const metadataLocale = appSeo.indexable ? appSeo.locale : locale;

    document.documentElement.lang = metadataLocale;
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
    const appCopy = appSeo.indexable ? appSeoCopy(appSeo) : undefined;
    const title = appCopy?.title ?? t(metadataLocale, titleKey);
    const description = appCopy?.description ?? t(metadataLocale, descriptionKey);
    const canonicalUrl = appSeo.indexable
      ? appSeoCanonical(location.pathname, location.search)
      : `${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`;

    document.title = title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
    setMetaContent('meta[name="description"]', description);
    setMetaContent(
      'meta[name="robots"]',
      isCustomizer
        ? appSeo.indexable
          ? 'index,follow'
          : 'noindex,follow'
        : isProfile
          ? 'noindex,follow'
          : 'index,follow',
    );
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    const alternates = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
    ];
    if (isCustomizer && appSeo.indexable) {
      alternates.forEach((link) => link.remove());
      const queryFor = (nextLocale: Locale): string =>
        appSeo.template ? `?template=${appSeo.template}&lang=${nextLocale}` : `?lang=${nextLocale}`;
      for (const nextLocale of ['en', 'ru', 'uk'] as const) {
        const link = document.createElement('link');

        link.rel = 'alternate';
        link.hreflang = nextLocale;
        link.href = `${SITE_URL}/create${queryFor(nextLocale)}`;
        document.head.append(link);
      }
      const fallback = document.createElement('link');

      fallback.rel = 'alternate';
      fallback.hreflang = 'x-default';
      fallback.href = `${SITE_URL}/create${appSeo.template ? `?template=${appSeo.template}&lang=en` : '?lang=en'}`;
      document.head.append(fallback);
    } else if (isCustomizer) {
      alternates.forEach((link) => link.remove());
    } else {
      restoreStaticAlternates();
    }
    const jsonLd = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    if (jsonLd && isCustomizer) {
      try {
        jsonLd.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: title,
          url: canonicalUrl,
          description,
          inLanguage: metadataLocale,
          applicationCategory: 'DesignApplication',
          operatingSystem: 'Web',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        });
      } catch {
        // Keep the static JSON-LD if a host has supplied malformed data.
      }
    } else if (jsonLd && STATIC_JSON_LD) {
      jsonLd.textContent = STATIC_JSON_LD;
    }
  }, [isCustomizer, isProfile, locale, location.pathname, location.search, normalizedPath]);

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
