import { t, type Locale } from '../../../infrastructure/i18n';
import { useAnalytics } from '../../../infrastructure/telemetry';
import './AnalyticsConsentBanner.module.css';

export const AnalyticsConsentBanner = ({ locale }: { locale: Locale }) => {
  const { consent, setConsent } = useAnalytics();
  if (consent !== 'unknown') return null;

  return (
    <aside className="analytics-consent" aria-labelledby="analytics-consent-title">
      <div>
        <h2 id="analytics-consent-title">{t(locale, 'analytics.consentTitle')}</h2>
        <p>
          {t(locale, 'analytics.consentBody')}{' '}
          <a href="/privacy.html">{t(locale, 'analytics.privacyLink')}</a>
        </p>
      </div>
      <div className="analytics-consent-actions">
        <button
          type="button"
          className="analytics-consent-decline"
          onClick={() => setConsent('declined')}
        >
          {t(locale, 'analytics.decline')}
        </button>
        <button
          type="button"
          className="analytics-consent-accept"
          onClick={() => setConsent('accepted')}
        >
          {t(locale, 'analytics.accept')}
        </button>
      </div>
    </aside>
  );
};
