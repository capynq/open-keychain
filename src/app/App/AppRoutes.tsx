import { Suspense, useLayoutEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, type Location } from 'react-router';

import { resolveSeoRoute } from '@/features/seo';
import { SeoPage } from '@/pages/seo/SeoPage';

import { hostedMode } from '../../features/hosted/config';
import { type Locale } from '../../infrastructure/i18n/config';
import { RouteLoading, type RouteLoadingVariant } from '../components/RouteLoading/RouteLoading';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from '../routes';
import {
  CustomizerPage,
  LandingPage,
  PrivacyPage,
  ProfilePage,
  SeoNotFoundPage,
} from '../routing/routeModules';

const RouteCommitted = ({ children }: { children: ReactNode }) => {
  useLayoutEffect(() => {
    const root = document.getElementById('root');

    root?.removeAttribute('inert');
    root?.setAttribute('data-app-ready', 'true');
    document.documentElement.setAttribute('data-app-ready', 'true');
  }, []);

  return children;
};

export type AppRoutesProps = {
  location: Location;
  normalizedPath: string;
  displayLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onSeoCtaClick: (locale: Locale, cta: string) => void;
  onSeoLocaleChange: (locale: Locale) => void;
};

export const AppRoutes = ({
  location,
  normalizedPath,
  displayLocale,
  onLocaleChange,
  onSeoCtaClick,
  onSeoLocaleChange,
}: AppRoutesProps) => {
  const seoRoute = resolveSeoRoute(location.pathname);
  const loadingVariant: RouteLoadingVariant =
    normalizedPath === LANDING_ROUTE
      ? 'landing'
      : normalizedPath === PROFILE_ROUTE
        ? 'profile'
        : normalizedPath === '/privacy' || seoRoute
          ? 'reference'
          : 'not-found';
  const suspenseFallback =
    normalizedPath === CREATE_ROUTE ? null : (
      <RouteLoading variant={loadingVariant} locale={displayLocale} />
    );

  return (
    <Suspense fallback={suspenseFallback}>
      <RouteCommitted>
        <Routes>
          <Route
            path={LANDING_ROUTE}
            element={
              <LandingPage
                resetKey={`${location.pathname}${location.search}${location.hash}`}
                locale={displayLocale}
                onLocaleChange={onLocaleChange}
              />
            }
          />
          <Route
            path={CREATE_ROUTE}
            element={
              <CustomizerPage
                resetKey={`${location.pathname}${location.search}${location.hash}`}
                locale={displayLocale}
                onLocaleChange={onLocaleChange}
              />
            }
          />
          <Route
            path={PROFILE_ROUTE}
            element={
              hostedMode ? (
                <ProfilePage
                  resetKey={`${location.pathname}${location.search}${location.hash}`}
                  locale={displayLocale}
                  onLocaleChange={onLocaleChange}
                />
              ) : (
                <Navigate to={LANDING_ROUTE} replace />
              )
            }
          />
          <Route
            path="*"
            element={(() => {
              const page =
                normalizedPath === '/privacy' ? (
                  <PrivacyPage
                    resetKey={`${location.pathname}${location.search}${location.hash}`}
                    locale={displayLocale}
                    onLocaleChange={onSeoLocaleChange}
                  />
                ) : seoRoute ? (
                  <SeoPage
                    route={
                      seoRoute.kind === 'home' && seoRoute.path === '/'
                        ? { ...seoRoute, locale: displayLocale }
                        : seoRoute
                    }
                    onCtaClick={onSeoCtaClick}
                    onLocaleChange={onSeoLocaleChange}
                    resetKey={`${location.pathname}${location.search}${location.hash}`}
                  />
                ) : (
                  <SeoNotFoundPage
                    resetKey={`${location.pathname}${location.search}${location.hash}`}
                    locale={displayLocale}
                  />
                );

              return page;
            })()}
          />
        </Routes>
      </RouteCommitted>
    </Suspense>
  );
};
