import type { SeoCtaClick, SeoDispatcherProps } from './model/types';

import { SeoGuidePage, SeoHomePage, SeoHubPage, SeoTemplatePage } from './SeoPageLoaders';

export const SeoPage = ({
  route,
  onCtaClick,
  onLocaleChange,
  resetKey = route.path,
}: SeoDispatcherProps) => {
  const pageId =
    route.kind === 'template'
      ? route.templateId
      : route.kind === 'guide'
        ? route.guideSlug
        : route.kind;
  const handleCtaClick: SeoCtaClick | undefined = onCtaClick
    ? (locale, cta) => onCtaClick(locale, cta, route.kind, pageId)
    : undefined;

  switch (route.kind) {
    case 'home':
      return (
        <SeoHomePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={handleCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'template':
      return (
        <SeoTemplatePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={handleCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'guide':
      return (
        <SeoGuidePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={handleCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'templates':
    case 'guides':
      return (
        <SeoHubPage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={handleCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
  }
};
