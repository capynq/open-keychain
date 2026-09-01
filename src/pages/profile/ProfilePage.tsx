import { useLocation, useNavigate } from 'react-router';

import type { KeychainParams } from '../../domain/keychain/model/types';

import { AppHeader } from '../../app/components/AppHeader/AppHeader';
import { t, type Locale } from '../../infrastructure/i18n';
import { ProfileAuth } from './components/ProfileAuth';
import { ProfileProjects } from './components/ProfileProjects';
import { ProfileSaveCard } from './components/ProfileSaveCard';
import { useProfileSession } from './hooks/useProfileSession';
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
  const currentParams = (location.state as ProfileLocationState)?.currentParams;
  const session = useProfileSession(locale, currentParams);
  const canSaveCurrent = Boolean(session.account && currentParams);

  return (
    <div className="profile-shell">
      <AppHeader variant="landing" locale={locale} onLocaleChange={onLocaleChange} />
      <main className="profile-page" aria-label={t(locale, 'profile')}>
        <section className="profile-intro">
          <p className="eyebrow">{t(locale, 'brandName')}</p>
          <h1>{t(locale, 'profileTitle')}</h1>
          <p>
            {session.account
              ? t(locale, 'profileSignedIn', { email: session.account.email })
              : t(locale, 'profileSignedOut')}
          </p>
        </section>
        {session.loading ? (
          <p className="profile-status" role="status">
            {t(locale, 'profileLoading')}
          </p>
        ) : session.loadError ? (
          <section className="profile-status" role="alert">
            <p>{session.loadError}</p>
            <button type="button" onClick={() => void session.refresh()}>
              {t(locale, 'profileRetry')}
            </button>
          </section>
        ) : session.account ? (
          <div className="profile-grid">
            <ProfileProjects
              locale={locale}
              projects={session.projects}
              deleteError={session.deleteError}
              deletingId={session.deletingId}
              onOpen={(project) =>
                navigate('/create', { state: { projectParams: project.params } })
              }
              onDelete={(project) => void session.removeProject(project)}
            />
            <ProfileSaveCard
              locale={locale}
              canSaveCurrent={canSaveCurrent}
              projectName={session.projectName}
              defaultProjectName={session.defaultProjectName}
              saveBusy={session.saveBusy}
              saveError={session.saveError}
              onProjectNameChange={session.setProjectName}
              onSave={session.saveCurrent}
              onSignOut={() => void session.logOut()}
            />
          </div>
        ) : (
          <ProfileAuth
            locale={locale}
            authMode={session.authMode}
            name={session.name}
            email={session.email}
            password={session.password}
            authBusy={session.authBusy}
            authError={session.authError}
            onNameChange={session.setName}
            onEmailChange={session.setEmail}
            onPasswordChange={session.setPassword}
            onSubmit={session.submitAuth}
            onToggleMode={() =>
              session.setAuthMode(session.authMode === 'sign-in' ? 'sign-up' : 'sign-in')
            }
          />
        )}
      </main>
    </div>
  );
};
