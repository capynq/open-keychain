import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { detectLocale, setLocale, t, type Locale } from '../infrastructure/i18n';
import { CustomizerPage } from './pages/CustomizerPage';
import { LandingPage } from './pages/LandingPage';
import { CREATE_ROUTE, LANDING_ROUTE } from './routes';
import './styles/app.css';

const SITE_URL = 'https://open-keychain.com';

const setMetaContent = (selector: string, content: string): void => {
  const meta = document.querySelector<HTMLMetaElement>(selector);
  if (meta) meta.content = content;
};

const App = () => {
  const [locale, setActiveLocale] = useState<Locale>(detectLocale);
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;

  useEffect(() => {
    document.documentElement.lang = locale;
    const titleKey = isCustomizer ? 'documentCreateTitle' : 'documentLandingTitle';
    const descriptionKey = isCustomizer ? 'metaCreateDescription' : 'metaLandingDescription';
    const title = t(locale, titleKey);
    const description = t(locale, descriptionKey);
    const canonicalPath = normalizedPath === '/' ? '/' : normalizedPath;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    document.title = title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
  }, [isCustomizer, locale, normalizedPath]);

  const onLocaleChange = (nextLocale: Locale): void => {
    setActiveLocale(nextLocale);
    void setLocale(nextLocale);
  };

  return (
    <Routes>
      <Route
        path={LANDING_ROUTE}
        element={<LandingPage locale={locale} onLocaleChange={onLocaleChange} />}
      />
      <Route
        path={CREATE_ROUTE}
        element={<CustomizerPage locale={locale} onLocaleChange={onLocaleChange} />}
      />
      <Route path="*" element={<Navigate to={LANDING_ROUTE} replace />} />
    </Routes>
  );
};

export default App;
