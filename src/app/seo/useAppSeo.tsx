import { useEffect } from 'react';

import {
  appSeoCanonical,
  appSeoCopy,
  buildSeoJsonLd,
  defaultSeoOgImagePath,
  localizedSeoPath,
  resolveAppSeoUrl,
  resolveSeoRoute,
  seoOgImagePath,
  seoPageMetadata,
  SEO_LOCALES,
  SEO_TEMPLATE_CATALOG,
  type SeoRoute,
} from '@/features/seo';

import { t, type Locale } from '../../infrastructure/i18n';
import { SeoSocialImageTags } from './SeoSocialImageTags';

const SITE_URL = 'https://open-keychain.com';

type UseAppSeoOptions = {
  locale: Locale;
  pathname: string;
  search: string;
  normalizedPath: string;
  isCustomizer: boolean;
  isProfile: boolean;
};

/** Keep the document language in sync for assistive technology and browser UI. */
export const useAppSeo = ({ locale, pathname }: UseAppSeoOptions): void => {
  useEffect(() => {
    const route = resolveSeoRoute(pathname);

    document.documentElement.lang =
      route?.kind === 'home' && route.path === '/' ? locale : (route?.locale ?? locale);
  }, [locale, pathname]);
};

const localizedPath = (route: SeoRoute, locale: Locale): string => {
  return localizedSeoPath(route, locale);
};

const jsonLdFor = (title: string, description: string, url: string, locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: title,
  description,
  url,
  inLanguage: locale,
  isPartOf: { '@type': 'WebSite', name: 'Open Keychain 3D', url: SITE_URL },
});

/** React 19 hoists these head elements and updates them on client-side route transitions. */
export const AppSeoHead = ({
  locale,
  pathname,
  search,
  normalizedPath,
  isCustomizer,
  isProfile,
}: UseAppSeoOptions) => {
  const route = resolveSeoRoute(pathname);
  const isPrivacy = normalizedPath === '/privacy';
  let title: string;
  let description: string;
  let canonicalUrl: string;
  let robots: 'index,follow' | 'noindex,follow';
  let alternates: readonly { locale: Locale; path: string }[] = [];
  let jsonLd: Record<string, unknown>;
  let ogImagePath = defaultSeoOgImagePath;

  if (isPrivacy) {
    title = t(locale, 'seo.navigation.privacy');
    description = t(locale, 'analytics.consentBody');
    canonicalUrl = `${SITE_URL}/privacy`;
    robots = 'noindex,follow';
    jsonLd = jsonLdFor(title, description, canonicalUrl, locale);
  } else if (route) {
    const metadataRoute =
      route.kind === 'home' && route.path === '/' ? { ...route, locale } : route;
    const metadata = seoPageMetadata(metadataRoute);

    title = metadata.title;
    description = metadata.description;
    canonicalUrl = `${SITE_URL}${metadata.canonicalPath}`;
    robots = 'index,follow';
    alternates = SEO_LOCALES.map((nextLocale) => ({
      locale: nextLocale,
      path: localizedPath(metadataRoute, nextLocale),
    }));
    jsonLd = buildSeoJsonLd(metadataRoute);
    ogImagePath = seoOgImagePath(metadataRoute);
  } else if (isCustomizer) {
    const appSeo = resolveAppSeoUrl(pathname, search);
    const metadataLocale = appSeo.indexable ? appSeo.locale : locale;
    const copy = appSeo.indexable ? appSeoCopy(appSeo) : undefined;

    title = copy?.title ?? t(metadataLocale, 'documentCreateTitle');
    description = copy?.description ?? t(metadataLocale, 'metaCreateDescription');
    canonicalUrl = appSeo.indexable
      ? appSeoCanonical(pathname, search)
      : `${SITE_URL}${normalizedPath}`;
    robots = appSeo.indexable ? 'index,follow' : 'noindex,follow';
    if (appSeo.indexable)
      alternates = SEO_LOCALES.map((nextLocale) => ({
        locale: nextLocale,
        path: `/create${appSeo.template ? `?template=${appSeo.template}&lang=${nextLocale}` : `?lang=${nextLocale}`}`,
      }));
    if (appSeo.template) {
      ogImagePath =
        SEO_TEMPLATE_CATALOG.find((template) => template.id === appSeo.template)?.previewSrc ??
        defaultSeoOgImagePath;
    }
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: title,
      url: canonicalUrl,
      description,
      inLanguage: metadataLocale,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
  } else if (isProfile) {
    title = t(locale, 'documentProfileTitle');
    description = t(locale, 'metaProfileDescription');
    canonicalUrl = `${SITE_URL}${normalizedPath}`;
    robots = 'noindex,follow';
    jsonLd = jsonLdFor(title, description, canonicalUrl, locale);
  } else {
    title = `${t(locale, 'seo.brand')} | ${t(locale, 'seo.notFoundTitle')}`;
    description = t(locale, 'seo.home.description');
    canonicalUrl = `${SITE_URL}${normalizedPath}`;
    robots = 'noindex,follow';
    jsonLd = jsonLdFor(title, description, canonicalUrl, locale);
  }

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <SeoSocialImageTags locale={locale} title={title} imagePath={ogImagePath} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {alternates.map(({ locale: alternateLocale, path }) => (
        <link
          key={alternateLocale}
          rel="alternate"
          hrefLang={alternateLocale}
          href={`${SITE_URL}${path}`}
        />
      ))}
      {alternates.length > 0 && (
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${alternates[0].path}`} />
      )}
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  );
};
