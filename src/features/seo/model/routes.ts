import type { Location } from 'react-router';
import { detectLocale, supportedLocales, type Locale } from '@/infrastructure/i18n';
import {
  SEO_GUIDE_CATALOG,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  seoGuidesPath,
  seoHomePath,
  seoTemplatePath,
  seoTemplatesPath,
  resolveSeoRoute,
  type SeoRoute,
} from '@/infrastructure/seo/catalog';

export const PRIVACY_PATH = '/privacy';
export const LEGACY_PRIVACY_PATH = '/privacy.html';

/** Return the canonical localized URL for an SEO route. */
export const localizedSeoPath = (route: SeoRoute, locale: Locale): string => {
  switch (route.kind) {
    case 'home':
      return seoHomePath(locale);
    case 'templates':
      return seoTemplatesPath(locale);
    case 'guides':
      return seoGuidesPath(locale);
    case 'template': {
      const template = SEO_TEMPLATE_CATALOG.find((item) => item.id === route.templateId);
      return template ? seoTemplatePath(locale, template) : seoTemplatesPath(locale);
    }
    case 'guide': {
      const guide = SEO_GUIDE_CATALOG.find((item) => item.slug === route.guideSlug);
      return guide ? seoGuidePath(locale, guide) : seoGuidesPath(locale);
    }
  }
};

export const privacyPath = (): string => PRIVACY_PATH;

export const customizerPath = (locale: Locale, templateId?: string): string =>
  templateId
    ? `/create?template=${encodeURIComponent(templateId)}&lang=${encodeURIComponent(locale)}`
    : `/create?lang=${encodeURIComponent(locale)}`;

const isLocale = (value: string | null): value is Locale =>
  value !== null && supportedLocales.includes(value as Locale);

export const localeFromSearch = (search: string): Locale | undefined => {
  const value = new URLSearchParams(search).get('lang');
  return isLocale(value) ? value : undefined;
};

export const detectInitialLocale = (search: string, pathname = ''): Locale => {
  const route = resolveSeoRoute(pathname);
  if (route && (route.kind !== 'home' || route.path !== '/')) return route.locale;
  return localeFromSearch(search) ?? route?.locale ?? detectLocale();
};

/** Localized SEO paths own their locale; generic app paths use query/state locale. */
export const resolveDisplayLocale = (
  location: Pick<Location, 'pathname' | 'search'>,
  appLocale: Locale,
): Locale => {
  const route = resolveSeoRoute(location.pathname);
  if (route && (route.kind !== 'home' || route.path !== '/')) return route.locale;
  return localeFromSearch(location.search) ?? appLocale;
};
