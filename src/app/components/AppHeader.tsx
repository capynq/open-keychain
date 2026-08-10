import { useTranslation } from 'react-i18next';
import { hostedMode, type HostedAccountState } from '../../features/hosted';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { AccountPopover } from './AccountPopover';

export const AppHeader = ({
  locale,
  onLocaleChange,
  exportOpen,
  onExportOpen,
  hosted,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen: () => void;
  hosted: HostedAccountState;
}) => {
  const { i18n } = useTranslation();

  return (
    <header className="topbar">
      <div className="brand-mark">
        <img src="/brand/open-keychain-mark.svg" alt="" width="34" height="34" />
        <div>
          <h1>Open Keychain</h1>
          <small>{t(locale, 'brandTagline')}</small>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="language-picker">
          <span className="sr-only">{t(locale, 'language')}</span>
          <select
            value={locale}
            onChange={(event) => {
              const next = event.target.value as Locale;

              onLocaleChange(next);
              void i18n.changeLanguage(next);
            }}
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="uk">UK</option>
          </select>
        </label>
        <a href="https://github.com/WilfredoN/open-keychain" className="github-link">
          {t(locale, 'openSource')}
        </a>
        <button
          type="button"
          className="export-header-button"
          onClick={onExportOpen}
          aria-haspopup="dialog"
          aria-expanded={exportOpen}
        >
          {t(locale, 'export')}
        </button>
        {hostedMode && (
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
};
