import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { detectLocale, setLocale, t, type Locale } from '../infrastructure/i18n';
import { CustomizerPage } from './pages/CustomizerPage';
import { LandingPage } from './pages/LandingPage';
import { CREATE_ROUTE, LANDING_ROUTE } from './routes';
import './styles/app.css';

const App = () => {
  const [locale, setActiveLocale] = useState<Locale>(detectLocale);
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isCustomizer = normalizedPath === CREATE_ROUTE;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = isCustomizer
      ? t(locale, 'documentCreateTitle')
      : t(locale, 'documentLandingTitle');
  }, [isCustomizer, locale]);

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
