import { SEO_GUIDE_CATALOG, SEO_GUIDE_COPY, type SeoRoute } from '@/features/seo';

import type { SeoCtaClick, SeoLocaleChange } from './model/types';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { CreateLink } from './components/SeoCta';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';

export const SeoGuidePage = ({
  locale,
  route,
  onCtaClick,
  onLocaleChange,
}: {
  locale: Locale;
  route: Extract<SeoRoute, { kind: 'guide' }>;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => {
  const guide = SEO_GUIDE_CATALOG.find((item) => item.slug === route.guideSlug);

  if (!guide) return null;

  const copy = SEO_GUIDE_COPY[locale][guide.key];

  return (
    <SeoShell>
      <SeoHeader locale={locale} route={route} onLocaleChange={onLocaleChange} />
      <main className="seo-main seo-guide">
        <h1>{copy.heading}</h1>
        <p className="seo-lede">{copy.intro}</p>
        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <CreateLink locale={locale} onCtaClick={onCtaClick} cta="create">
          {t(locale, 'seo.home.cta')}
        </CreateLink>
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};
