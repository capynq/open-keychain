import { AppHeader } from '@/app/components/AppHeader/AppHeader';
import { LandingFaq } from '@/app/components/landing/LandingFaq/LandingFaq';
import { LandingFooter } from '@/app/components/landing/LandingFooter/LandingFooter';
import { LandingHero } from '@/app/components/landing/LandingHero/LandingHero';
import { LandingRunModes } from '@/app/components/landing/LandingRunModes/LandingRunModes';
import { LandingTemplates } from '@/app/components/landing/LandingTemplates/LandingTemplates';
import { LandingTrust } from '@/app/components/landing/LandingTrust/LandingTrust';
import { LandingWorkflow } from '@/app/components/landing/LandingWorkflow/LandingWorkflow';

import type { Locale } from '../../infrastructure/i18n/config';

import { useAnalytics } from '../../infrastructure/telemetry/useTelemetry';
import './LandingPage.module.css';

export const LandingPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const { track } = useAnalytics();

  return (
    <div className="landing-shell">
      <AppHeader variant="landing" locale={locale} onLocaleChange={onLocaleChange} />
      <main>
        <LandingHero
          locale={locale}
          onStartDesigning={() => track('start_designing', { source: 'hero' })}
        />
        <LandingWorkflow locale={locale} />
        <LandingTemplates locale={locale} />
        <LandingRunModes locale={locale} />
        <LandingTrust locale={locale} />
        <LandingFaq locale={locale} />
      </main>
      <LandingFooter locale={locale} />
    </div>
  );
};
