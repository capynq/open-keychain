import type { TemplateId } from '../../domain/keychain';

export const SEO_LOCALES = ['en', 'ru', 'uk'] as const;
export type SeoLocale = (typeof SEO_LOCALES)[number];

export type SeoTemplateDefinition = {
  id: TemplateId;
  key: 'nameKeychain' | 'articulatedName' | 'nameplate' | 'plantLabel';
  previewSrc: string;
};

export const SEO_TEMPLATE_CATALOG: readonly SeoTemplateDefinition[] = [
  {
    id: 'name-keychain',
    key: 'nameKeychain',
    previewSrc: '/showcase/templates/name-keychain.png',
  },
  {
    id: 'articulated-name',
    key: 'articulatedName',
    previewSrc: '/showcase/templates/articulated-name.png',
  },
  {
    id: 'nameplate',
    key: 'nameplate',
    previewSrc: '/showcase/templates/nameplate.png',
  },
  {
    id: 'plant-label',
    key: 'plantLabel',
    previewSrc: '/showcase/templates/plant-label.png',
  },
];

export const seoLocalePrefix = (locale: SeoLocale): string => (locale === 'en' ? '' : `/${locale}`);

export const seoHomePath = (locale: SeoLocale): string => `${seoLocalePrefix(locale)}/`;

export const seoTemplatePath = (locale: SeoLocale, template: SeoTemplateDefinition): string =>
  `${seoLocalePrefix(locale)}/templates/${template.id}/`;

export const SEO_PAGE_MANIFEST = SEO_LOCALES.flatMap((locale) => [
  {
    kind: 'home' as const,
    locale,
    path: seoHomePath(locale),
  },
  ...SEO_TEMPLATE_CATALOG.map((template) => ({
    kind: 'template' as const,
    locale,
    path: seoTemplatePath(locale, template),
    templateId: template.id,
  })),
]);

export type SeoPageManifestEntry = (typeof SEO_PAGE_MANIFEST)[number];
