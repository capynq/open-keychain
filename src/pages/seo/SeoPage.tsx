import type { SeoDispatcherProps } from './model/types';

import { SeoGuidePage, SeoHomePage, SeoHubPage, SeoTemplatePage } from './SeoPageLoaders';

export const SeoPage = ({
  route,
  onCtaClick,
  onLocaleChange,
  resetKey = route.path,
}: SeoDispatcherProps) => {
  switch (route.kind) {
    case 'home':
      return (
        <SeoHomePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'template':
      return (
        <SeoTemplatePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'guide':
      return (
        <SeoGuidePage
          resetKey={resetKey}
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
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
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
  }
};
