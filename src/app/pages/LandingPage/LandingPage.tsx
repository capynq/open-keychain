/* eslint-disable padding-line-between-statements */
import type { Locale } from '../../../infrastructure/i18n';
import { AppHeader } from '../../components/AppHeader/AppHeader';
import { LandingHero } from '../../components/landing/LandingHero/LandingHero';
import { LandingFooter } from '../../components/landing/LandingFooter/LandingFooter';
import { LandingRunModes } from '../../components/landing/LandingRunModes/LandingRunModes';
import { LandingTemplates } from '../../components/landing/LandingTemplates/LandingTemplates';
import { LandingTrust } from '../../components/landing/LandingTrust/LandingTrust';
import { LandingWorkflow } from '../../components/landing/LandingWorkflow/LandingWorkflow';
import { useAnalytics } from '../../../infrastructure/telemetry';
import './LandingPage.module.css';
import '../../styles/landing.css';

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
      </main>
      <LandingFooter locale={locale} />
    </div>
  );
};
