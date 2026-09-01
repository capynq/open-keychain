import { lazy } from 'react';

import type { SeoRoute } from '@/features/seo';

import type { SeoCtaClick, SeoLocaleChange } from './model/types';

const SeoGuidePage = lazy(() =>
  import('./SeoGuidePage').then(({ SeoGuidePage: page }) => ({ default: page })),
);
const SeoHomePage = lazy(() =>
  import('./SeoHomePage').then(({ SeoHomePage: page }) => ({ default: page })),
);
const SeoHubPage = lazy(() =>
  import('./SeoHubPage').then(({ SeoHubPage: page }) => ({ default: page })),
);
const SeoTemplatePage = lazy(() =>
  import('./SeoTemplatePage').then(({ SeoTemplatePage: page }) => ({ default: page })),
);

export const SeoPage = ({
  route,
  onCtaClick,
  onLocaleChange,
}: {
  route: SeoRoute;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => {
  switch (route.kind) {
    case 'home':
      return (
        <SeoHomePage
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'template':
      return (
        <SeoTemplatePage
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
    case 'guide':
      return (
        <SeoGuidePage
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
          locale={route.locale}
          route={route}
          onCtaClick={onCtaClick}
          onLocaleChange={onLocaleChange}
        />
      );
  }
};
