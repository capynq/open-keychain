import { useState, type SubmitEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { AppHeader } from '@/app/components/AppHeader/AppHeader';
import { DEFAULT_PARAMS, type KeychainParams } from '@/entities/keychain/model/types';
import { useHostedAccount } from '@/features/hosted/hooks/useHostedAccount';

import type { Locale } from '../../infrastructure/i18n/config';

import { t } from '../../infrastructure/i18n/utils';
import { ProfileAuth } from './components/ProfileAuth';
import { ProfileBatch } from './components/ProfileBatch';
import { ProfilePresets } from './components/ProfilePresets';
import { ProfilePresetSaveCard } from './components/ProfilePresetSaveCard';
import './ProfilePage.module.css';
import '../../app/styles/profile.css';

type ProfileLocationState = { currentParams?: KeychainParams } | null;

export const ProfilePage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [presetName, setPresetName] = useState('');
  const currentParams = (location.state as ProfileLocationState)?.currentParams;
  const workspace = useHostedAccount(
    currentParams ?? DEFAULT_PARAMS,
    (params) => navigate('/create', { state: { projectParams: params } }),
    locale,
  );
  const canSaveCurrent = Boolean(workspace.account && currentParams);

  const saveCurrentPreset = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!currentParams) return;

    if (await workspace.savePreset(presetName, currentParams)) setPresetName('');
  };

  return (
    <div className="profile-shell">
      <AppHeader variant="landing" locale={locale} onLocaleChange={onLocaleChange} />
      <main className="profile-page" aria-label={t(locale, 'profile')}>
        <section className="profile-intro">
          <p className="eyebrow">{t(locale, 'brandName')}</p>
          <h1>{t(locale, 'workspaceTitle')}</h1>
          <p>
            {workspace.account
              ? t(locale, 'workspaceSignedIn', { email: workspace.account.email })
              : t(locale, 'workspaceSignedOut')}
          </p>
        </section>
        {workspace.loading ? (
          <p className="profile-status" role="status">
            {t(locale, 'workspaceLoading')}
          </p>
        ) : workspace.loadError ? (
          <section className="profile-status" role="alert">
            <p>{workspace.loadError}</p>
            <button type="button" onClick={() => void workspace.refresh()}>
              {t(locale, 'workspaceRetry')}
            </button>
          </section>
        ) : workspace.account ? (
          <div className="profile-grid">
            <div className="profile-main-column">
              <ProfilePresets
                locale={locale}
                presets={workspace.presets}
                deleteError={workspace.deleteError}
                deletingId={workspace.deletingId}
                onUse={workspace.loadPreset}
                onDelete={(preset) => void workspace.removePreset(preset)}
              />
              <ProfileBatch locale={locale} presets={workspace.presets} />
            </div>
            <ProfilePresetSaveCard
              locale={locale}
              canSaveCurrent={canSaveCurrent}
              presetName={presetName}
              saveBusy={workspace.saveBusy}
              saveError={workspace.saveError}
              onPresetNameChange={setPresetName}
              onSave={saveCurrentPreset}
              onSignOut={() => void workspace.logOut()}
            />
          </div>
        ) : (
          <ProfileAuth
            locale={locale}
            authMode={workspace.authMode}
            name={workspace.authName}
            email={workspace.authEmail}
            password={workspace.authPassword}
            authBusy={workspace.authBusy}
            authError={workspace.authError}
            onNameChange={workspace.setAuthName}
            onEmailChange={workspace.setAuthEmail}
            onPasswordChange={workspace.setAuthPassword}
            onSubmit={workspace.submitAuth}
            onToggleMode={() =>
              workspace.setAuthMode(workspace.authMode === 'sign-in' ? 'sign-up' : 'sign-in')
            }
          />
        )}
      </main>
    </div>
  );
};
