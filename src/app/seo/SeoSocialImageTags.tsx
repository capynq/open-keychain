import { SEO_LOCALES } from '@/features/seo';
import type { Locale } from '../../infrastructure/i18n';

const SITE_URL = 'https://open-keychain.com';
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', ru: 'ru_RU', uk: 'uk_UA' };

export const SeoSocialImageTags = ({
  locale,
  title,
  imagePath,
}: {
  locale: Locale;
  title: string;
  imagePath: string;
}) => (
  <>
    <meta property="og:image" content={`${SITE_URL}${imagePath}`} />
    <meta property="og:image:alt" content={title} />
    <meta property="og:locale" content={OG_LOCALE[locale]} />
    {SEO_LOCALES.filter((alternateLocale) => alternateLocale !== locale).map((alternateLocale) => (
      <meta
        key={`og-${alternateLocale}`}
        property="og:locale:alternate"
        content={OG_LOCALE[alternateLocale]}
      />
    ))}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content={`${SITE_URL}${imagePath}`} />
  </>
);
