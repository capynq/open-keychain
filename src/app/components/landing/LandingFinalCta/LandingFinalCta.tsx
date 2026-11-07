import type { Locale } from '@/infrastructure/i18n';

import { FeedbackLine } from '@/features/feedback/components/FeedbackLine/FeedbackLine';
import { t } from '@/infrastructure/i18n';

import { HeroNameForm } from '../HeroNameForm/HeroNameForm';
import styles from './LandingFinalCta.module.css';

/** Closing call to action: the same name field as the hero, plus a direct line to us. */
export const LandingFinalCta = ({ locale }: { locale: Locale }) => (
  <section className={`${styles.root} landing-final-cta`} aria-labelledby="final-cta-title">
    <div className={styles.copy}>
      <p className="landing-kicker">{t(locale, 'landing.finalKicker')}</p>
      <h2 id="final-cta-title">{t(locale, 'landing.finalTitle')}</h2>
      <p className={styles.body}>{t(locale, 'landing.finalBody')}</p>
    </div>
    <div className={styles.actions}>
      <HeroNameForm locale={locale} source="final_cta" />
      <FeedbackLine locale={locale} className={styles.feedback} />
    </div>
  </section>
);
