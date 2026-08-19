import { hostedMode, type HostedAccountState } from '../../features/hosted';
import type { KeychainParams } from '../../domain/keychain';
import { Link } from 'react-router';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { BrandMark } from './BrandMark';
import { LanguagePicker } from './LanguagePicker';
import { PROFILE_ROUTE } from '../routes';

export const CustomizerNavigationHeader = ({
  locale,
  onLocaleChange,
  exportOpen,
  onExportOpen,
  hosted,
  currentParams,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen?: () => void;
  hosted?: HostedAccountState;
  currentParams?: KeychainParams;
}) => (
  <header className="topbar">
    <BrandMark />
    <button
      type="button"
      className="export-header-button"
      onClick={onExportOpen}
      aria-haspopup="dialog"
      aria-expanded={exportOpen}
    >
      {t(locale, 'export')}
    </button>
    <div className="topbar-actions">
      <LanguagePicker locale={locale} onLocaleChange={onLocaleChange} />
      {hostedMode && hosted && (
        <Link className="header-profile-link" to={PROFILE_ROUTE} state={{ currentParams }}>
          {hosted.account ? t(locale, 'profile') : t(locale, 'signIn')}
        </Link>
      )}
    </div>
  </header>
);
