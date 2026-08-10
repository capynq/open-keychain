import { useTranslation } from 'react-i18next';
import type { HostedProject, HostedUser } from '../../features/hosted';
import { hostedMode } from '../../features/hosted';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { AccountPopover } from './AccountPopover';

export const AppHeader = ({
  locale,
  onLocaleChange,
  exportOpen,
  onExportOpen,
  account,
  projects,
  accountOpen,
  onAccountToggle,
  authMode,
  authName,
  authEmail,
  authPassword,
  authBusy,
  authError,
  setAuthMode,
  setAuthName,
  setAuthEmail,
  setAuthPassword,
  submitAuth,
  saveCurrentProject,
  loadProject,
  logOut,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen: () => void;
  account: HostedUser | undefined;
  projects: HostedProject[];
  accountOpen: boolean;
  onAccountToggle: () => void;
  authMode: 'sign-in' | 'sign-up';
  authName: string;
  authEmail: string;
  authPassword: string;
  authBusy: boolean;
  authError: string | undefined;
  setAuthMode: (mode: 'sign-in' | 'sign-up') => void;
  setAuthName: (name: string) => void;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  submitAuth: Parameters<typeof AccountPopover>[0]['submitAuth'];
  saveCurrentProject: () => Promise<void>;
  loadProject: (project: HostedProject) => void;
  logOut: () => Promise<void>;
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
            <button type="button" className="account-button" onClick={onAccountToggle}>
              {account ? account.name : t(locale, 'signIn')}
            </button>
            {accountOpen && (
              <div className="account-popover">
                <AccountPopover
                  locale={locale}
                  account={account}
                  projects={projects}
                  authMode={authMode}
                  authName={authName}
                  authEmail={authEmail}
                  authPassword={authPassword}
                  authBusy={authBusy}
                  authError={authError}
                  setAuthMode={setAuthMode}
                  setAuthName={setAuthName}
                  setAuthEmail={setAuthEmail}
                  setAuthPassword={setAuthPassword}
                  submitAuth={submitAuth}
                  saveCurrentProject={saveCurrentProject}
                  loadProject={loadProject}
                  logOut={logOut}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
