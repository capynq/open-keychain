import type { ComponentType } from 'react';

import type { Locale } from '../../infrastructure/i18n/config';

import { createRetryableLazy } from '../../shared/ui/RetryableLazy';

export type AppPageProps = { locale: Locale; onLocaleChange: (locale: Locale) => void };
export type SeoPageProps = { locale: Locale; onLocaleChange?: (locale: Locale) => void };

export const LandingPage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/landing/LandingPage').then(({ LandingPage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
export const CustomizerPage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/customizer/CustomizerPage').then(({ CustomizerPage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
export const ProfilePage = createRetryableLazy<AppPageProps>(() =>
  import('@/pages/profile/ProfilePage').then(({ ProfilePage: page }) => ({
    default: page as ComponentType<AppPageProps>,
  })),
);
export const PrivacyPage = createRetryableLazy<SeoPageProps>(() =>
  import('@/pages/seo/PrivacyPage').then(({ PrivacyPage: page }) => ({
    default: page as ComponentType<SeoPageProps>,
  })),
);
export const SeoNotFoundPage = createRetryableLazy<{ locale?: Locale }>(() =>
  import('@/pages/seo/SeoNotFoundPage').then(({ SeoNotFoundPage: page }) => ({
    default: page as ComponentType<{ locale?: Locale }>,
  })),
);

export const preloadCreateRoute = (): Promise<void> => CustomizerPage.preload();
