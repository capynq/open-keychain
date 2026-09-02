import { supportedLocales, type Locale } from '../i18n/config';
import { t } from '../i18n/utils';
import {
  SEO_GUIDE_CATALOG,
  SEO_PAGE_MANIFEST,
  SEO_TEMPLATE_CATALOG,
  seoGuidesPath,
  seoHomePath,
  seoTemplatesPath,
  type SeoRoute,
} from './catalog';
import { SEO_GUIDE_COPY, SEO_HUB_COPY } from './guides';

export const INDEXABLE_APP_TEMPLATES = [
  'name-keychain',
  'articulated-name',
  'nameplate',
  'plant-label',
] as const;
type IndexableTemplate = (typeof INDEXABLE_APP_TEMPLATES)[number];

export type AppSeoResolution = {
  indexable: boolean;
  locale: Locale;
  template?: IndexableTemplate;
};

const isLocale = (value: string | null): value is Locale =>
  value !== null && supportedLocales.includes(value as Locale);

/** Accept only the finite, shareable customizer URL vocabulary. */
export const resolveAppSeoUrl = (pathname: string, search: string): AppSeoResolution => {
  const fallback: AppSeoResolution = { indexable: false, locale: 'en' };
  if (pathname !== '/create') return fallback;
  const params = new URLSearchParams(search);
  const entries = [...params.keys()];
  const locale = params.get('lang');
  if (!isLocale(locale)) return fallback;
  const template = params.get('template');
  if (template === null && search === `?lang=${locale}` && entries.length === 1)
    return { indexable: true, locale };
  if (
    template &&
    entries.length === 2 &&
    search === `?template=${template}&lang=${locale}` &&
    entries.every((key) => key === 'template' || key === 'lang') &&
    (INDEXABLE_APP_TEMPLATES as readonly string[]).includes(template)
  ) {
    return { indexable: true, locale, template: template as IndexableTemplate };
  }
  return { ...fallback, locale };
};

const templateSeoKey: Record<IndexableTemplate, string> = {
  'name-keychain': 'nameKeychain',
  'articulated-name': 'articulatedName',
  nameplate: 'nameplate',
  'plant-label': 'plantLabel',
};

export const appSeoCopy = (
  resolution: AppSeoResolution,
): { title: string; description: string } => {
  if (resolution.template && resolution.indexable) {
    const key = templateSeoKey[resolution.template];
    return {
      title: t(resolution.locale, `seo.templates.${key}.title`),
      description: t(resolution.locale, `seo.templates.${key}.description`),
    };
  }
  return {
    title: t(resolution.locale, 'seo.home.title'),
    description: t(resolution.locale, 'seo.home.description'),
  };
};

export const appSeoCanonical = (pathname: string, search: string): string => {
  const resolution = resolveAppSeoUrl(pathname, search);
  if (!resolution.indexable) return `https://open-keychain.com${pathname}${search}`;
  const query = resolution.template
    ? `?template=${resolution.template}&lang=${resolution.locale}`
    : `?lang=${resolution.locale}`;
  return `https://open-keychain.com/create${query}`;
};

export type SeoPageMetadata = {
  title: string;
  description: string;
  locale: Locale;
  canonicalPath: string;
  lastModified?: string;
};

/** Complete head data shared by browser and static SEO renderers. */
export type SeoHeadModel = SeoPageMetadata & {
  canonicalUrl: string;
  robots: 'index,follow' | 'noindex,follow';
  ogImagePath: string;
  alternates: readonly { locale: Locale; path: string }[];
  jsonLd: Record<string, unknown>;
};

const brandFirstTitle = (locale: Locale, title: string): string => {
  const brand = t(locale, 'seo.brand');
  return title.startsWith(`${brand} | `) ? title : `${brand} | ${title}`;
};

const routeLastModified = (route: SeoRoute): string | undefined =>
  SEO_PAGE_MANIFEST.find((entry) => entry.path === route.path)?.lastModified;

/** Return browser metadata for a resolved content route. */
export const seoPageMetadata = (route: SeoRoute): SeoPageMetadata => {
  const { locale } = route;
  if (route.kind === 'home') {
    return {
      locale,
      canonicalPath: route.path,
      title: t(locale, 'seo.home.title'),
      description: t(locale, 'seo.home.description'),
      lastModified: routeLastModified(route),
    };
  }
  if (route.kind === 'templates') {
    return {
      locale,
      canonicalPath: route.path,
      title: brandFirstTitle(locale, t(locale, 'seo.navigation.templates')),
      description: t(locale, 'seo.home.templatesBody'),
      lastModified: routeLastModified(route),
    };
  }
  if (route.kind === 'guides') {
    const copy = SEO_HUB_COPY[locale];
    return {
      locale,
      canonicalPath: route.path,
      title: copy.title,
      description: copy.description,
      lastModified: routeLastModified(route),
    };
  }
  if (route.kind === 'template') {
    const template = SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === route.templateId);
    const key =
      route.templateId === 'name-keychain'
        ? 'nameKeychain'
        : route.templateId === 'articulated-name'
          ? 'articulatedName'
          : route.templateId === 'plant-label'
            ? 'plantLabel'
            : 'nameplate';
    return {
      locale,
      canonicalPath: route.path,
      title: t(locale, `seo.templates.${key}.title`),
      description: t(locale, `seo.templates.${key}.description`),
      lastModified: template?.lastModified,
    };
  }
  const guide =
    route.kind === 'guide'
      ? SEO_GUIDE_CATALOG.find((candidate) => candidate.slug === route.guideSlug)
      : undefined;
  const copy = guide ? SEO_GUIDE_COPY[locale][guide.key] : SEO_HUB_COPY[locale];
  return {
    locale,
    canonicalPath: route.path,
    title: copy.title,
    description: copy.description,
    lastModified: guide?.lastModified,
  };
};

/** Canonical public name for React SEO consumers. */
export const buildSeoMetadata = seoPageMetadata;

const DEFAULT_OG_IMAGE_PATH = '/brand/open-keychain-og.png';

/** Return the artwork used when a resolved route is shared on social platforms. */
export const seoOgImagePath = (route: SeoRoute): string => {
  if (route.kind === 'template') {
    return (
      SEO_TEMPLATE_CATALOG.find((template) => template.id === route.templateId)?.previewSrc ??
      DEFAULT_OG_IMAGE_PATH
    );
  }
  if (route.kind === 'guide') {
    return (
      SEO_GUIDE_CATALOG.find((guide) => guide.slug === route.guideSlug)?.ogImageSrc ??
      DEFAULT_OG_IMAGE_PATH
    );
  }
  return DEFAULT_OG_IMAGE_PATH;
};

export const defaultSeoOgImagePath = DEFAULT_OG_IMAGE_PATH;

export const buildSeoJsonLd = (route: SeoRoute): Record<string, unknown> => {
  const metadata = seoPageMetadata(route);
  const url = `https://open-keychain.com${metadata.canonicalPath}`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': 'https://open-keychain.com/#organization',
      name: t(route.locale, 'seo.brand'),
      url: 'https://open-keychain.com/',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://open-keychain.com/#website',
      name: t(route.locale, 'seo.brand'),
      url: 'https://open-keychain.com/',
      inLanguage: route.locale,
      publisher: { '@id': 'https://open-keychain.com/#organization' },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: metadata.title,
      description: metadata.description,
      inLanguage: route.locale,
      dateModified: metadata.lastModified,
      isPartOf: { '@id': 'https://open-keychain.com/#website' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: t(route.locale, 'seo.navigation.home'),
          item: `https://open-keychain.com${seoHomePath(route.locale)}`,
        },
        ...(route.kind === 'template' || route.kind === 'guide'
          ? [
              {
                '@type': 'ListItem',
                position: 2,
                name:
                  route.kind === 'template'
                    ? t(route.locale, 'seo.navigation.templates')
                    : t(route.locale, 'seo.navigation.guides'),
                item: `https://open-keychain.com${
                  route.kind === 'template'
                    ? seoTemplatesPath(route.locale)
                    : seoGuidesPath(route.locale)
                }`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: metadata.title,
                item: url,
              },
            ]
          : []),
      ],
    },
  ];
  if (route.kind === 'guide') {
    const guide = SEO_GUIDE_CATALOG.find((candidate) => candidate.slug === route.guideSlug);
    graph.push({
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: metadata.title,
      description: metadata.description,
      url,
      inLanguage: route.locale,
      image: `https://open-keychain.com${guide?.ogImageSrc ?? DEFAULT_OG_IMAGE_PATH}`,
      dateModified: guide?.lastModified,
      lastModified: guide?.lastModified,
      author: { '@type': 'Organization', name: t(route.locale, 'seo.brand') },
      publisher: {
        '@type': 'Organization',
        name: t(route.locale, 'seo.brand'),
        url: 'https://open-keychain.com/',
      },
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
};
