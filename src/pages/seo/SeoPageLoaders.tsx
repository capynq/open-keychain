import type { ComponentType } from 'react';

import { createRetryableLazy } from '@/shared/ui/RetryableLazy';

import type {
  SeoGuidePageProps,
  SeoHomePageProps,
  SeoHubPageProps,
  SeoTemplatePageProps,
} from './model/types';

export const SeoGuidePage = createRetryableLazy<SeoGuidePageProps>(() =>
  import('./SeoGuidePage').then(({ SeoGuidePage: page }) => ({
    default: page as ComponentType<SeoGuidePageProps>,
  })),
);

export const SeoHomePage = createRetryableLazy<SeoHomePageProps>(() =>
  import('./SeoHomePage').then(({ SeoHomePage: page }) => ({
    default: page as ComponentType<SeoHomePageProps>,
  })),
);

export const SeoHubPage = createRetryableLazy<SeoHubPageProps>(() =>
  import('./SeoHubPage').then(({ SeoHubPage: page }) => ({
    default: page as ComponentType<SeoHubPageProps>,
  })),
);

export const SeoTemplatePage = createRetryableLazy<SeoTemplatePageProps>(() =>
  import('./SeoTemplatePage').then(({ SeoTemplatePage: page }) => ({
    default: page as ComponentType<SeoTemplatePageProps>,
  })),
);
