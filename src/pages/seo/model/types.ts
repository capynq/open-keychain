import type { SeoRoute } from '@/features/seo';

import type { Locale } from '../../../infrastructure/i18n/config';

export type Faq = { question: string; answer: string };

export type SeoCtaClick = (locale: Locale, cta: string) => void;

export type SeoLocaleChange = (locale: Locale) => void;

export type SeoPageProps = {
  locale: Locale;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
};

export type SeoDispatcherProps = {
  route: SeoRoute;
  resetKey?: string;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
};

export type SeoHomePageProps = SeoPageProps & {
  route: Extract<SeoRoute, { kind: 'home' }>;
  resetKey: string;
};

export type SeoTemplatePageProps = SeoPageProps & {
  route: Extract<SeoRoute, { kind: 'template' }>;
  resetKey: string;
};

export type SeoGuidePageProps = SeoPageProps & {
  route: Extract<SeoRoute, { kind: 'guide' }>;
  resetKey: string;
};

export type SeoHubPageProps = SeoPageProps & {
  route: Extract<SeoRoute, { kind: 'templates' | 'guides' }>;
  resetKey: string;
};
