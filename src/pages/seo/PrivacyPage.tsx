import { Link } from 'react-router';

import { seoHomePath, type SeoRoute } from '@/features/seo';

import type { SeoLocaleChange } from './model/types';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { useAnalytics } from '../../infrastructure/telemetry/useTelemetry';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';

const homeRoute = (locale: Locale): SeoRoute & { kind: 'home' } => ({
  kind: 'home',
  locale,
  path: seoHomePath(locale),
});

export const PrivacyPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: SeoLocaleChange;
}) => {
  const { consent, setConsent } = useAnalytics();

  return (
    <SeoShell>
      <SeoHeader
        locale={locale}
        route={homeRoute(locale)}
        onLocaleChange={onLocaleChange}
        privacy
      />
      <main className="seo-main seo-privacy">
        <h1>{t(locale, 'seo.navigation.privacy')}</h1>
        <p className="seo-lede">{t(locale, 'analytics.consentBody')}</p>
        <h2>{t(locale, 'analytics.privacyDetailsTitle')}</h2>
        <p>{t(locale, 'analytics.privacyDetailsBody')}</p>
        <div className="seo-privacy-consent" aria-live="polite">
          <p>
            {t(
              locale,
              consent === 'accepted' ? 'analytics.consentActive' : 'analytics.consentInactive',
            )}
          </p>
          <button
            type="button"
            className="seo-cta"
            aria-pressed={consent === 'accepted'}
            onClick={() => setConsent('accepted')}
          >
            {t(locale, 'analytics.accept')}
          </button>
          <button
            type="button"
            className="seo-cta seo-privacy-decline"
            aria-pressed={consent === 'declined'}
            onClick={() => setConsent('declined')}
          >
            {t(locale, 'analytics.decline')}
          </button>
        </div>
        <h2>{t(locale, 'landing.localFirstTitle')}</h2>
        <p>{t(locale, 'landing.localFirstBody')}</p>
        <h2>{t(locale, 'landing.betaTitle')}</h2>
        <p>{t(locale, 'landing.betaBody')}</p>
        <Link className="seo-cta" to={seoHomePath(locale)}>
          {t(locale, 'seo.navigation.home')}
        </Link>
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};
