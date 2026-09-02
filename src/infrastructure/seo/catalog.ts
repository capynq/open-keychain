import type { TemplateId } from '../../domain/keychain/model/types';

export const SEO_LOCALES = ['en', 'ru', 'uk'] as const;
export type SeoLocale = (typeof SEO_LOCALES)[number];

export type SeoTemplateDefinition = {
  id: TemplateId;
  key: 'nameKeychain' | 'articulatedName' | 'nameplate' | 'plantLabel';
  previewSrc: string;
  /** Date the template landing page content was last materially changed. */
  lastModified: string;
};

export type SeoGuideDefinition = {
  slug: string;
  key: 'stlVs3mf' | 'nameKeychainPrinting' | 'articulatedPrinting' | 'plantLabelPrinting';
  ogImageSrc: string;
  lastModified: string;
};

export const SEO_GUIDE_CATALOG: readonly SeoGuideDefinition[] = [
  {
    slug: 'stl-vs-3mf',
    key: 'stlVs3mf',
    ogImageSrc: '/showcase/prints/example_1-en.png',
    lastModified: '2026-08-22',
  },
  {
    slug: 'how-to-print-a-name-keychain',
    key: 'nameKeychainPrinting',
    ogImageSrc: '/showcase/templates/name-keychain.png',
    lastModified: '2026-08-22',
  },
  {
    slug: 'articulated-vs-standard-keychain',
    key: 'articulatedPrinting',
    ogImageSrc: '/showcase/templates/articulated-name.png',
    lastModified: '2026-08-22',
  },
  {
    slug: 'printable-plant-label-guide',
    key: 'plantLabelPrinting',
    ogImageSrc: '/showcase/templates/plant-label.png',
    lastModified: '2026-08-22',
  },
];

export const SEO_TEMPLATE_CATALOG: readonly SeoTemplateDefinition[] = [
  {
    id: 'name-keychain',
    key: 'nameKeychain',
    previewSrc: '/showcase/templates/name-keychain.png',
    lastModified: '2026-08-22',
  },
  {
    id: 'articulated-name',
    key: 'articulatedName',
    previewSrc: '/showcase/templates/articulated-name.png',
    lastModified: '2026-08-22',
  },
  {
    id: 'nameplate',
    key: 'nameplate',
    previewSrc: '/showcase/templates/nameplate.png',
    lastModified: '2026-08-22',
  },
  {
    id: 'plant-label',
    key: 'plantLabel',
    previewSrc: '/showcase/templates/plant-label.png',
    lastModified: '2026-08-22',
  },
];

export const seoLocalePrefix = (locale: SeoLocale): string => (locale === 'en' ? '' : `/${locale}`);

export const seoHomePath = (locale: SeoLocale): string => `${seoLocalePrefix(locale)}/`;

export const seoTemplatePath = (locale: SeoLocale, template: SeoTemplateDefinition): string =>
  `${seoLocalePrefix(locale)}/templates/${template.id}/`;

export const seoTemplatesPath = (locale: SeoLocale): string =>
  `${seoLocalePrefix(locale)}/templates/`;

export const seoGuidesPath = (locale: SeoLocale): string => `${seoLocalePrefix(locale)}/guides/`;

export const seoGuidePath = (locale: SeoLocale, guide: SeoGuideDefinition): string =>
  `${seoGuidesPath(locale)}${guide.slug}/`;

export type SeoAppRoute = {
  kind: 'app';
  locale: SeoLocale;
  path: string;
  templateId?: Exclude<TemplateId, 'magnet'>;
  lastModified: string;
};

/** The finite set of localized customizer URLs that search engines may index. */
export const SEO_APP_MANIFEST: readonly SeoAppRoute[] = SEO_LOCALES.flatMap((locale) => [
  { kind: 'app' as const, locale, path: `/create?lang=${locale}`, lastModified: '2026-08-24' },
  ...SEO_TEMPLATE_CATALOG.filter((template) => template.id !== 'magnet').map((template) => ({
    kind: 'app' as const,
    locale,
    path: `/create?template=${template.id}&lang=${locale}`,
    templateId: template.id as Exclude<TemplateId, 'magnet'>,
    lastModified: '2026-08-24',
  })),
]);

export const SEO_PAGE_MANIFEST = SEO_LOCALES.flatMap((locale) => [
  {
    kind: 'home' as const,
    locale,
    path: seoHomePath(locale),
    lastModified: '2026-08-22',
  },
  ...SEO_TEMPLATE_CATALOG.map((template) => ({
    kind: 'template' as const,
    locale,
    path: seoTemplatePath(locale, template),
    templateId: template.id,
    lastModified: template.lastModified,
  })),
  {
    kind: 'templates' as const,
    locale,
    path: seoTemplatesPath(locale),
    lastModified: '2026-08-22',
  },
  {
    kind: 'guides' as const,
    locale,
    path: seoGuidesPath(locale),
    lastModified: '2026-08-22',
  },
  ...SEO_GUIDE_CATALOG.map((guide) => ({
    kind: 'guide' as const,
    locale,
    path: seoGuidePath(locale, guide),
    guideSlug: guide.slug,
    lastModified: guide.lastModified,
  })),
]);

export type SeoPageManifestEntry = (typeof SEO_PAGE_MANIFEST)[number];
export const SEO_SITEMAP_MANIFEST = [...SEO_PAGE_MANIFEST, ...SEO_APP_MANIFEST] as const;

/** A normalized SEO route used by both the browser and the static generator. */
export type SeoRoute =
  | { kind: 'home'; locale: SeoLocale; path: string }
  | { kind: 'templates'; locale: SeoLocale; path: string }
  | { kind: 'guides'; locale: SeoLocale; path: string }
  | {
      kind: 'template';
      locale: SeoLocale;
      path: string;
      templateId: Exclude<TemplateId, 'magnet'>;
    }
  | { kind: 'guide'; locale: SeoLocale; path: string; guideSlug: string };

export type SeoPageKind = SeoRoute['kind'] | 'privacy' | 'not-found' | 'app';

const trimPath = (pathname: string): string => {
  const value = pathname.replace(/\/+$/, '');
  return value || '/';
};

/** Resolve only the finite, localized, trailing-slash-insensitive SEO vocabulary. */
export const resolveSeoRoute = (pathname: string): SeoRoute | undefined => {
  const normalized = trimPath(pathname);
  const entry = SEO_PAGE_MANIFEST.find((candidate) => trimPath(candidate.path) === normalized);
  if (!entry) return undefined;
  if (entry.kind === 'template') {
    return {
      kind: entry.kind,
      locale: entry.locale,
      path: entry.path,
      templateId: entry.templateId as Exclude<TemplateId, 'magnet'>,
    };
  }
  if (entry.kind === 'guide') {
    return { kind: entry.kind, locale: entry.locale, path: entry.path, guideSlug: entry.guideSlug };
  }
  return { kind: entry.kind, locale: entry.locale, path: entry.path };
};
