import type { ComponentType } from 'react';

import { Navigate, Route, Routes, type Location } from 'react-router';

import { resolveSeoRoute } from '@/features/seo';
import { SeoPage } from '@/pages/seo/SeoPage';
import { createRetryableLazy } from '@/shared/ui/RetryableLazy';

import { hostedMode } from '../../features/hosted/config';
import { type Locale } from '../../infrastructure/i18n/config';
import { CREATE_ROUTE, LANDING_ROUTE, PROFILE_ROUTE } from '../routes';

type AppPageProps = { locale: Locale; onLocaleChange: (locale: Locale) => void };
type SeoPageProps = { locale: Locale; onLocaleChange?: (locale: Locale) => void };

const LandingPage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/landing/LandingPage').then(({ LandingPage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
const CustomizerPage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/customizer/CustomizerPage').then(({ CustomizerPage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
const ProfilePage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/profile/ProfilePage').then(({ ProfilePage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
const PrivacyPage = createRetryableLazy<SeoPageProps>(() =>
  import('@/pages/seo/PrivacyPage').then(({ PrivacyPage: page }) => ({
    default: page as ComponentType<SeoPageProps>,
  })),
);
const SeoNotFoundPage = createRetryableLazy<{ locale?: Locale }>(() =>
  import('@/pages/seo/SeoNotFoundPage').then(({ SeoNotFoundPage: page }) => ({
    default: page as ComponentType<{ locale?: Locale }>,
  })),
);

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
}: AppRoutesProps) => (
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
        const seoRoute = resolveSeoRoute(location.pathname);

        if (normalizedPath === '/privacy') {
          return (
            <PrivacyPage
              resetKey={`${location.pathname}${location.search}${location.hash}`}
              locale={displayLocale}
              onLocaleChange={onSeoLocaleChange}
            />
          );
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
            resetKey={`${location.pathname}${location.search}${location.hash}`}
          />
        ) : (
          <SeoNotFoundPage
            resetKey={`${location.pathname}${location.search}${location.hash}`}
            locale={displayLocale}
          />
        );
      })()}
    />
  </Routes>
);
