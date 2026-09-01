import { useNavigate } from 'react-router';

import { LandingNavigationHeader } from '@/app/components/LandingNavigationHeader/LandingNavigationHeader';
import { seoGuidesPath, seoHomePath, seoTemplatesPath, type SeoRoute } from '@/features/seo';

import type { SeoLocaleChange } from '../model/types';

import { type Locale } from '../../../infrastructure/i18n/config';
import { t } from '../../../infrastructure/i18n/utils';
import { localizedPath } from '../model/localized-path';

export const SeoHeader = ({
  locale,
  route,
  onLocaleChange,
  privacy = false,
}: {
  locale: Locale;
  route: SeoRoute;
  onLocaleChange?: SeoLocaleChange;
  privacy?: boolean;
}) => {
  const navigate = useNavigate();
  const languagePaths = Object.fromEntries(
    (['en', 'ru', 'uk'] as const).map((nextLocale) => [
      nextLocale,
      privacy ? `/privacy?lang=${nextLocale}` : localizedPath(route, nextLocale),
    ]),
  ) as Record<Locale, string>;

  return (
    <LandingNavigationHeader
      locale={locale}
      seo={{
        homePath: seoHomePath(locale),
        templatesPath: seoTemplatesPath(locale),
        guidesPath: seoGuidesPath(locale),
        howItWorksPath: `${seoHomePath(locale)}#how-it-works`,
        templatesLabel: t(locale, 'seo.navigation.templates'),
        guidesLabel: t(locale, 'seo.navigation.guides'),
        howItWorksLabel: t(locale, 'seo.navigation.howItWorks'),
        languagePaths,
        onLocaleChange: (nextLocale) => {
          onLocaleChange?.(nextLocale);
          navigate(languagePaths[nextLocale]);
        },
      }}
    />
  );
};
