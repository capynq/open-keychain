import type { SeoRoute } from '@/features/seo';

import { ConfiguratorShowcase } from '@/app/components/landing/ConfiguratorShowcase/ConfiguratorShowcase';
import { LandingFaq } from '@/app/components/landing/LandingFaq/LandingFaq';
import { LandingRunModes } from '@/app/components/landing/LandingRunModes/LandingRunModes';
import { LandingTemplates } from '@/app/components/landing/LandingTemplates/LandingTemplates';
import { LandingTrust } from '@/app/components/landing/LandingTrust/LandingTrust';
import { LandingWorkflow } from '@/app/components/landing/LandingWorkflow/LandingWorkflow';

import type { SeoCtaClick, SeoLocaleChange } from './model/types';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { CreateLink } from './components/SeoCta';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';

export const SeoHomePage = ({
  locale,
  route,
  onCtaClick,
  onLocaleChange,
}: {
  locale: Locale;
  route: SeoRoute & { kind: 'home' };
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => (
  <SeoShell>
    <SeoHeader locale={locale} route={route} onLocaleChange={onLocaleChange} />
    <main className="seo-main seo-home">
      <p className="seo-eyebrow">{t(locale, 'seo.brand')}</p>
      <h1>{t(locale, 'seo.home.heading')}</h1>
      <p className="seo-lede">{t(locale, 'seo.home.intro')}</p>
      <CreateLink locale={locale} onCtaClick={onCtaClick} cta="create">
        {t(locale, 'seo.home.cta')}
      </CreateLink>
    </main>
    <div className="seo-landing-sections">
      <section
        className="landing-section seo-showcase-section"
        aria-label={t(locale, 'landing.previewLabel')}
      >
        <ConfiguratorShowcase locale={locale} />
      </section>
      <LandingWorkflow locale={locale} />
      <LandingTemplates locale={locale} />
      <LandingRunModes locale={locale} />
      <LandingTrust locale={locale} />
      <LandingFaq locale={locale} />
    </div>
    <SeoFooter locale={locale} />
  </SeoShell>
);
