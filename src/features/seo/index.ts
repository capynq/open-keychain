export * from './catalog';
export * from '../../infrastructure/seo/guides';
export {
  appSeoCanonical,
  appSeoCopy,
  buildSeoJsonLd,
  buildSeoMetadata,
  defaultSeoOgImagePath,
  resolveAppSeoUrl,
  SEO_ORGANIZATION_LOGO,
  SEO_SITE_ALTERNATE_NAME,
  SEO_SITE_NAME,
  seoOgImagePath,
  seoPageMetadata,
  type SeoHeadModel,
  type SeoPageMetadata,
} from '../../infrastructure/seo/app-metadata';
export {
  LEGACY_PRIVACY_PATH,
  PRIVACY_PATH,
  customizerPath,
  localeFromSearch,
  localizedSeoPath,
  privacyPath,
  resolveDisplayLocale,
} from './model';
