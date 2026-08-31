import { useEffect } from 'react';
import { detectLocale, supportedLocales, t, type Locale } from '../../infrastructure/i18n';
import {
  appSeoCanonical,
  appSeoCopy,
  resolveAppSeoUrl,
} from '../../infrastructure/seo/app-metadata';

const SITE_URL = 'https://open-keychain.com';
const STATIC_JSON_LD =
  typeof document === 'undefined'
    ? ''
    : (document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
        ?.textContent ?? '');

export const localeFromSearch = (search: string): Locale | undefined => {
  const requestedLocale = new URLSearchParams(search).get('lang');

  return requestedLocale && supportedLocales.includes(requestedLocale as Locale)
    ? (requestedLocale as Locale)
    : undefined;
};

export const detectInitialLocale = (search: string): Locale =>
  localeFromSearch(search) ?? detectLocale();

const setMetaContent = (selector: string, content: string): void => {
  const meta = document.querySelector<HTMLMetaElement>(selector);

  if (meta) meta.content = content;
};

const restoreStaticAlternates = (): void => {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((link) => link.remove());

  for (const [hreflang, path] of [
    ['en', '/'],
    ['ru', '/ru/'],
    ['uk', '/uk/'],
    ['x-default', '/'],
  ] as const) {
    const link = document.createElement('link');

    link.rel = 'alternate';
    link.hreflang = hreflang;
    link.href = `${SITE_URL}${path}`;
    document.head.append(link);
  }
};

type UseAppSeoOptions = {
  locale: Locale;
  pathname: string;
  search: string;
  normalizedPath: string;
  isCustomizer: boolean;
  isProfile: boolean;
};

export const useAppSeo = ({
  locale,
  pathname,
  search,
  normalizedPath,
  isCustomizer,
  isProfile,
}: UseAppSeoOptions): void => {
  useEffect(() => {
    const appSeo = isCustomizer ? resolveAppSeoUrl(pathname, search) : { indexable: false, locale };
    const metadataLocale = appSeo.indexable ? appSeo.locale : locale;
    const titleKey = isProfile
      ? 'documentProfileTitle'
      : isCustomizer
        ? 'documentCreateTitle'
        : 'documentLandingTitle';
    const descriptionKey = isProfile
      ? 'metaProfileDescription'
      : isCustomizer
        ? 'metaCreateDescription'
        : 'metaLandingDescription';
    const appCopy = appSeo.indexable ? appSeoCopy(appSeo) : undefined;
    const title = appCopy?.title ?? t(metadataLocale, titleKey);
    const description = appCopy?.description ?? t(metadataLocale, descriptionKey);
    const canonicalUrl = appSeo.indexable
      ? appSeoCanonical(pathname, search)
      : `${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`;

    document.documentElement.lang = metadataLocale;
    document.title = title;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (canonical) canonical.href = canonicalUrl;

    setMetaContent('meta[name="description"]', description);
    setMetaContent(
      'meta[name="robots"]',
      isCustomizer
        ? appSeo.indexable
          ? 'index,follow'
          : 'noindex,follow'
        : isProfile
          ? 'noindex,follow'
          : 'index,follow',
    );
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    const alternates = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
    ];
    if (isCustomizer && appSeo.indexable) {
      alternates.forEach((link) => link.remove());
      const queryFor = (nextLocale: Locale): string =>
        appSeo.template ? `?template=${appSeo.template}&lang=${nextLocale}` : `?lang=${nextLocale}`;

      for (const nextLocale of ['en', 'ru', 'uk'] as const) {
        const link = document.createElement('link');

        link.rel = 'alternate';
        link.hreflang = nextLocale;
        link.href = `${SITE_URL}/create${queryFor(nextLocale)}`;
        document.head.append(link);
      }

      const fallback = document.createElement('link');

      fallback.rel = 'alternate';
      fallback.hreflang = 'x-default';
      fallback.href = `${SITE_URL}/create${appSeo.template ? `?template=${appSeo.template}&lang=en` : '?lang=en'}`;
      document.head.append(fallback);
    } else if (isCustomizer) {
      alternates.forEach((link) => link.remove());
    } else {
      restoreStaticAlternates();
    }

    const jsonLd = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    if (jsonLd && isCustomizer) {
      try {
        jsonLd.textContent = JSON.stringify({
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
        });
      } catch {
        // Keep the static JSON-LD if a host has supplied malformed data.
      }
    } else if (jsonLd && STATIC_JSON_LD) {
      jsonLd.textContent = STATIC_JSON_LD;
    }
  }, [isCustomizer, isProfile, locale, normalizedPath, pathname, search]);
};
