import type { HostedAccountState } from '../../features/hosted';
import { t, type Locale } from '../../infrastructure/i18n';

export const AccountPopover = ({
  locale,
  state,
}: {
  locale: Locale;
  state: HostedAccountState;
}) => {
  const {
    account,
    projects,
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
  } = state;
  if (account)
    return (
      <>
        <strong>{t(locale, 'gallery')}</strong>
        <div className="project-list">
          {projects.length ? (
            projects.map((project) => (
              <button type="button" key={project.id} onClick={() => loadProject(project)}>
                {project.name}
              </button>
            ))
          ) : (
            <small>{t(locale, 'galleryEmpty')}</small>
          )}
        </div>
        <button type="button" onClick={() => void saveCurrentProject()}>
          {t(locale, 'saveProject')}
        </button>
        <button type="button" onClick={() => void logOut()}>
          {t(locale, 'signOut')}
        </button>
      </>
    );
  return (
    <form onSubmit={submitAuth} className="account-form">
      <strong>{authMode === 'sign-up' ? t(locale, 'createAccount') : t(locale, 'signIn')}</strong>
      {authMode === 'sign-up' && (
        <input
          value={authName}
          onChange={(event) => setAuthName(event.target.value)}
          placeholder={t(locale, 'fullName')}
          required
        />
      )}
      <input
        type="email"
        value={authEmail}
        onChange={(event) => setAuthEmail(event.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        minLength={10}
        value={authPassword}
        onChange={(event) => setAuthPassword(event.target.value)}
        placeholder={t(locale, 'password')}
        required
      />
      {authError && <small className="account-error">{authError}</small>}
      <button type="submit" disabled={authBusy}>
        {authBusy
          ? t(locale, 'updating')
          : authMode === 'sign-up'
            ? t(locale, 'createAccount')
            : t(locale, 'signIn')}
      </button>
      <button
        type="button"
        onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}
      >
        {authMode === 'sign-in' ? t(locale, 'createAccount') : t(locale, 'signIn')}
      </button>
    </form>
  );
};
