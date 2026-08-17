import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';

export const LandingTrust = ({ locale }: { locale: Locale }) => (
  <section className="landing-trust" aria-label={t(locale, 'landing.trustLabel')}>
    <div>
      <p className="landing-kicker">{t(locale, 'landing.localFirstKicker')}</p>
      <h2>{t(locale, 'landing.localFirstTitle')}</h2>
      <p>{t(locale, 'landing.localFirstBody')}</p>
    </div>
    <div>
      <p className="landing-kicker">{t(locale, 'landing.betaKicker')}</p>
      <h2>{t(locale, 'landing.betaTitle')}</h2>
      <p>{t(locale, 'landing.betaBody')}</p>
    </div>
  </section>
);
