import { Suspense, useLayoutEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, type Location } from 'react-router';

import type { SeoCtaTrack } from '@/pages/seo/model/types';

import { resolveSeoRoute } from '@/features/seo';
import { SeoPage } from '@/pages/seo/SeoPage';

import { hostedMode } from '../../features/hosted/config';
import { type Locale } from '../../infrastructure/i18n/config';
import { commitBoot } from '../boot/handoff';
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
  useLayoutEffect(() => commitBoot(), []);

  return children;
};

export type AppRoutesProps = {
  location: Location;
  normalizedPath: string;
  displayLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onSeoCtaClick: SeoCtaTrack;
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
    normalizedPath === PROFILE_ROUTE
      ? 'profile'
      : normalizedPath === '/privacy' || seoRoute
        ? 'reference'
        : 'not-found';
  /* Landing and Customizer cold loads show their boot frame; client navigation keeps the old
   * page during the transition, so neither needs a skeleton of its own. */
  const suspenseFallback =
    normalizedPath === CREATE_ROUTE || normalizedPath === LANDING_ROUTE ? null : (
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
