import { SeoGuidePage } from './SeoGuidePage';
import { SeoHomePage } from './SeoHomePage';
import { SeoHubPage } from './SeoHubPage';
import { SeoTemplatePage } from './SeoTemplatePage';
import type { SeoCtaClick, SeoLocaleChange } from './model';
import type { SeoRoute } from '@/features/seo';

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
