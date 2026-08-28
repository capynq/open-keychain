import type { Locale } from '@/infrastructure/i18n';
import { t } from '@/infrastructure/i18n';
import { HOW_IT_WORKS } from '../content';
import { LandingSectionHeading } from '../LandingSectionHeading/LandingSectionHeading';
import styles from './LandingWorkflow.module.css';

const stepNumber = (index: number) => String(index + 1).padStart(2, '0');

export const LandingWorkflow = ({ locale }: { locale: Locale }) => (
  <section
    className={`${styles.root} landing-section landing-how`}
    id="how-it-works"
    aria-labelledby="how-title"
  >
    <LandingSectionHeading
      kicker={t(locale, 'landing.howKicker')}
      title={t(locale, 'landing.howTitle')}
      body={t(locale, 'landing.howBody')}
      titleId="how-title"
    />
    <div className="landing-step-grid">
      {HOW_IT_WORKS.map((step, index) => (
        <article className="landing-step-card" key={step}>
          <span>{stepNumber(index)}</span>
          <h3>{t(locale, `landing.steps.${step}.title`)}</h3>
          <p>{t(locale, `landing.steps.${step}.detail`)}</p>
        </article>
      ))}
    </div>
  </section>
);
