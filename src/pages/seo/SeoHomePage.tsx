import { t, type Locale } from '../../infrastructure/i18n';
import {
  ConfiguratorShowcase,
  LandingFaq,
  LandingRunModes,
  LandingTemplates,
  LandingTrust,
  LandingWorkflow,
} from '@/components/landing/sections';
import { CreateLink, SeoFooter, SeoHeader, SeoShell } from './components';
import type { SeoCtaClick, SeoLocaleChange } from './model';
import type { SeoRoute } from '@/features/seo';

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
