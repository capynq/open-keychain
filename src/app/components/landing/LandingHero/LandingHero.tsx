import { Link } from 'react-router';
import type { Locale } from '@/infrastructure/i18n';
import { t } from '@/infrastructure/i18n';
import { CREATE_ROUTE } from '@/app/routes';
import { HOW_IT_WORKS } from '../content';
import { ConfiguratorShowcase } from '../ConfiguratorShowcase/ConfiguratorShowcase';
import styles from './LandingHero.module.css';

const stepNumber = (index: number) => String(index + 1).padStart(2, '0');

export const LandingHero = ({
  locale,
  onStartDesigning,
}: {
  locale: Locale;
  onStartDesigning?: () => void;
}) => (
  <section className={`${styles.root} landing-hero`} aria-labelledby="landing-title">
    <div className="landing-hero-copy">
      <p className="landing-kicker">{t(locale, 'landing.heroKicker')}</p>
      <h1 id="landing-title">{t(locale, 'landing.heroTitle')}</h1>
      <p className="landing-lede">{t(locale, 'landing.heroBody')}</p>
      <div className="landing-actions">
        <Link
          className="landing-button landing-button-primary"
          to={CREATE_ROUTE}
          onClick={onStartDesigning}
        >
          {t(locale, 'landing.startDesigning')}
          <span aria-hidden="true">→</span>
        </Link>
        <a
          className="landing-button landing-button-secondary"
          href="https://github.com/capynq/open-keychain"
        >
          {t(locale, 'landing.viewSource')}
        </a>
      </div>
      <ol className="landing-process" aria-label={t(locale, 'landing.workflowLabel')}>
        {HOW_IT_WORKS.map((step, index) => (
          <li key={step}>
            <span>{stepNumber(index)}</span>
            <strong>{t(locale, `landing.steps.${step}.title`)}</strong>
            <small>{t(locale, `landing.steps.${step}.body`)}</small>
          </li>
        ))}
      </ol>
    </div>
    <ConfiguratorShowcase locale={locale} />
  </section>
);
