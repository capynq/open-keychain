import type { ComponentType } from 'react';

import type { SeoRoute } from '@/features/seo';

import { createRetryableLazy } from '@/shared/ui/RetryableLazy';

import type { Locale } from '../../infrastructure/i18n/config';
import type { SeoCtaClick, SeoLocaleChange } from './model/types';

type SeoPageProps = {
  locale: Locale;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
};
type SeoDispatcherProps = {
  route: SeoRoute;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
  resetKey?: string;
};
type SeoHomeProps = SeoPageProps & { route: Extract<SeoRoute, { kind: 'home' }> };
type SeoTemplateProps = SeoPageProps & { route: Extract<SeoRoute, { kind: 'template' }> };
type SeoGuideProps = SeoPageProps & { route: Extract<SeoRoute, { kind: 'guide' }> };
type SeoHubProps = SeoPageProps & { route: Extract<SeoRoute, { kind: 'templates' | 'guides' }> };

const SeoGuidePage = createRetryableLazy<SeoGuideProps>(() =>
  import('./SeoGuidePage').then(({ SeoGuidePage: page }) => ({
    default: page as ComponentType<SeoGuideProps>,
  })),
);
const SeoHomePage = createRetryableLazy<SeoHomeProps>(() =>
  import('./SeoHomePage').then(({ SeoHomePage: page }) => ({
    default: page as ComponentType<SeoHomeProps>,
  })),
);
const SeoHubPage = createRetryableLazy<SeoHubProps>(() =>
  import('./SeoHubPage').then(({ SeoHubPage: page }) => ({
    default: page as ComponentType<SeoHubProps>,
  })),
);
const SeoTemplatePage = createRetryableLazy<SeoTemplateProps>(() =>
  import('./SeoTemplatePage').then(({ SeoTemplatePage: page }) => ({
    default: page as ComponentType<SeoTemplateProps>,
  })),
);

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
