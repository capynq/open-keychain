import { hostedMode, type HostedAccountState } from '../../features/hosted';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { AccountPopover } from './AccountPopover';
import { BrandMark } from './BrandMark';
import { LanguagePicker } from './LanguagePicker';

export const CustomizerNavigationHeader = ({
  locale,
  onLocaleChange,
  exportOpen,
  onExportOpen,
  hosted,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen?: () => void;
  hosted?: HostedAccountState;
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
      <a href="https://github.com/capynq/open-keychain" className="github-link">
        {t(locale, 'openSource')}
      </a>
      {hostedMode && hosted && (
        <div className="account-menu">
          <button
            type="button"
            className="account-button"
            onClick={() => hosted.setAccountOpen(!hosted.accountOpen)}
          >
            {hosted.account ? hosted.account.name : t(locale, 'signIn')}
          </button>
          {hosted.accountOpen && (
            <div className="account-popover">
              <AccountPopover locale={locale} state={hosted} />
            </div>
          )}
        </div>
      )}
    </div>
  </header>
);
