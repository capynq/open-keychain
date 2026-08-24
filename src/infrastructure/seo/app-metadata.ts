import { supportedLocales, t, type Locale } from '../i18n';

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
