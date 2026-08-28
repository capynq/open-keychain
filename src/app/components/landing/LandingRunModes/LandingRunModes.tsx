import type { Locale } from '@/infrastructure/i18n';
import { t } from '@/infrastructure/i18n';
import { RUN_OPTIONS } from '../content';
import { LandingSectionHeading } from '../LandingSectionHeading/LandingSectionHeading';
import { RunModeCard } from '../RunModeCard/RunModeCard';
import styles from './LandingRunModes.module.css';

export const LandingRunModes = ({ locale }: { locale: Locale }) => (
  <section
    className={`${styles.root} landing-section landing-run`}
    id="run"
    aria-labelledby="run-title"
  >
    <LandingSectionHeading
      kicker={t(locale, 'landing.runKicker')}
      title={t(locale, 'landing.runTitle')}
      body={t(locale, 'landing.runBody')}
      titleId="run-title"
    />
    <div className="landing-run-grid">
      {RUN_OPTIONS.map((option) => (
        <RunModeCard key={option} locale={locale} option={option} />
      ))}
    </div>
  </section>
);
