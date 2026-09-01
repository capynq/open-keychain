import {
  SEO_GUIDE_CATALOG,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  seoGuidesPath,
  seoHomePath,
  seoTemplatePath,
  seoTemplatesPath,
  type SeoRoute,
} from '../../../features/seo';
import type { Locale } from '../../../infrastructure/i18n';

/** Return the localized URL for the same SEO route in another locale. */
export const localizedPath = (route: SeoRoute, locale: Locale): string => {
  if (route.kind === 'home') return seoHomePath(locale);

  if (route.kind === 'templates') return seoTemplatesPath(locale);

  if (route.kind === 'guides') return seoGuidesPath(locale);

  if (route.kind === 'template') {
    const template = SEO_TEMPLATE_CATALOG.find((item) => item.id === route.templateId);

    return template ? seoTemplatePath(locale, template) : seoTemplatesPath(locale);
  }

  const guide = SEO_GUIDE_CATALOG.find(
    (item) => item.slug === ('guideSlug' in route ? route.guideSlug : ''),
  );

  return guide ? seoGuidePath(locale, guide) : seoGuidesPath(locale);
};
