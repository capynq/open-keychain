import { Link } from 'react-router';
import { hostedMode } from '../../features/hosted';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { CREATE_ROUTE, PROFILE_ROUTE } from '../routes';
import { BrandMark } from './BrandMark';
import { LanguagePicker } from './LanguagePicker';

export const LandingNavigationHeader = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => (
  <header className="topbar landing-topbar">
    <BrandMark />
    <nav className="landing-nav" aria-label={t(locale, 'landing.navigation')}>
      <a href="#how-it-works">{t(locale, 'landing.navHow')}</a>
      <a href="#products">{t(locale, 'landing.navProducts')}</a>
      <a href="#run">{t(locale, 'landing.navRun')}</a>
    </nav>
    <div className="topbar-actions landing-topbar-actions">
      <LanguagePicker locale={locale} onLocaleChange={onLocaleChange} />
      {hostedMode && (
        <Link className="header-profile-link" to={PROFILE_ROUTE}>
          {t(locale, 'profile')}
        </Link>
      )}
      <Link className="landing-header-cta" to={CREATE_ROUTE}>
        {t(locale, 'landing.startDesigning')}
      </Link>
    </div>
  </header>
);
