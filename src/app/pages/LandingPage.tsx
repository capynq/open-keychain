/* eslint-disable padding-line-between-statements */
import type { Locale } from '../../infrastructure/i18n';
import { AppHeader } from '../components/AppHeader';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingRunModes } from '../components/landing/LandingRunModes';
import { LandingTemplates } from '../components/landing/LandingTemplates';
import { LandingTrust } from '../components/landing/LandingTrust';
import { LandingWorkflow } from '../components/landing/LandingWorkflow';
import { useAnalytics } from '../../infrastructure/telemetry';
import '../styles/landing.css';

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
