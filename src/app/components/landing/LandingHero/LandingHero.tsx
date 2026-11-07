import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import { ConfiguratorShowcase } from '../ConfiguratorShowcase/ConfiguratorShowcase';
import { HeroNameForm } from '../HeroNameForm/HeroNameForm';
import styles from './LandingHero.module.css';

export const LandingHero = ({ locale }: { locale: Locale }) => (
  <section className={`${styles.root} landing-hero`} aria-labelledby="landing-title">
    <div className="landing-hero-copy">
      <p className="landing-kicker">{t(locale, 'landing.heroKicker')}</p>
      <h1 id="landing-title">{t(locale, 'landing.heroTitle')}</h1>
      <p className="landing-lede">{t(locale, 'landing.heroBody')}</p>
      <HeroNameForm locale={locale} source="hero" />
    </div>
    <ConfiguratorShowcase locale={locale} />
  </section>
);
