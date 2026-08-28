import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FONT_CATALOG } from '../../../domain/keychain/fonts/catalog';
import { isLocalFontId } from '../../../domain/keychain/fonts/local-provider';
import type { KeychainParams } from '../../../domain/keychain/model/types';
import {
  currentUser,
  deleteProject,
  listProjects,
  saveProject,
  signIn,
  signOut,
  signUp,
  type HostedProject,
  type HostedUser,
} from '../../../features/hosted';
import { t, type Locale } from '../../../infrastructure/i18n';
import { AppHeader } from '../../components/AppHeader/AppHeader';
import { CREATE_ROUTE } from '../../routes';
import './ProfilePage.module.css';
import '../../styles/profile.css';

type ProfileLocationState = { currentParams?: KeychainParams } | null;

const projectParamsForHosting = (params: KeychainParams): Record<string, unknown> => ({
  ...params,
  fontId: isLocalFontId(params.fontId) ? FONT_CATALOG[0].id : params.fontId,
});

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
  const [account, setAccount] = useState<HostedUser>();
  const [projects, setProjects] = useState<HostedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [projectName, setProjectName] = useState(currentParams?.text || '');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const user = await currentUser();

      setAccount(user);
      setProjects(user ? await listProjects() : []);
    } catch {
      setLoadError(t(locale, 'profileLoadError'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      const response =
        authMode === 'sign-up'
          ? await signUp(name, email, password)
          : await signIn(email, password);

      setAccount(response.user);
      setProjects(await listProjects());
      setPassword('');
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : t(locale, 'profileLoadError'));
    } finally {
      setAuthBusy(false);
    }
  };

  const canSaveCurrent = Boolean(account && currentParams);
  const defaultProjectName = useMemo(
    () => (currentParams?.text ? `${currentParams.text} keychain` : ''),
    [currentParams?.text],
  );

  const saveCurrent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!currentParams) return;
    const trimmedName = projectName.trim() || defaultProjectName;
    if (!trimmedName) return;
    setSaveBusy(true);
    setSaveError(undefined);
    try {
      const response = await saveProject(trimmedName, projectParamsForHosting(currentParams));

      setProjects((items) => [response.project, ...items]);
      setProjectName('');
    } catch {
      setSaveError(t(locale, 'profileSaveError'));
    } finally {
      setSaveBusy(false);
    }
  };

  const removeProject = async (project: HostedProject): Promise<void> => {
    if (!window.confirm(t(locale, 'profileDeleteConfirm', { name: project.name }))) return;
    setDeletingId(project.id);
    setDeleteError(undefined);
    try {
      await deleteProject(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
    } catch {
      setDeleteError(t(locale, 'profileDeleteError'));
    } finally {
      setDeletingId(undefined);
    }
  };

  const logOut = async (): Promise<void> => {
    await signOut();
    setAccount(undefined);
    setProjects([]);
  };

  return (
    <div className="profile-shell">
      <AppHeader variant="landing" locale={locale} onLocaleChange={onLocaleChange} />
      <main className="profile-page" aria-label={t(locale, 'profile')}>
        <section className="profile-intro">
          <p className="eyebrow">OPEN KEYCHAIN</p>
          <h1>{t(locale, 'profileTitle')}</h1>
          <p>
            {account
              ? t(locale, 'profileSignedIn', { email: account.email })
              : t(locale, 'profileSignedOut')}
          </p>
        </section>

        {loading ? (
          <p className="profile-status" role="status">
            {t(locale, 'profileLoading')}
          </p>
        ) : loadError ? (
          <section className="profile-status" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void refresh()}>
              {t(locale, 'profileRetry')}
            </button>
          </section>
        ) : account ? (
          <div className="profile-grid">
            <section
              className="profile-card profile-projects"
              aria-labelledby="saved-projects-title"
            >
              <div className="profile-card-heading">
                <h2 id="saved-projects-title">{t(locale, 'profileProjects')}</h2>
                <Link to={CREATE_ROUTE}>{t(locale, 'profileCreate')}</Link>
              </div>
              {deleteError && (
                <p className="profile-error" role="alert">
                  {deleteError}
                </p>
              )}
              {projects.length ? (
                <ul>
                  {projects.map((project) => (
                    <li key={project.id}>
                      <div>
                        <strong>{project.name}</strong>
                        <small>{new Date(project.updated_at).toLocaleDateString(locale)}</small>
                      </div>
                      <div className="profile-project-actions">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(CREATE_ROUTE, { state: { projectParams: project.params } })
                          }
                        >
                          {t(locale, 'profileOpen')}
                        </button>
                        <button
                          type="button"
                          className="profile-delete"
                          disabled={deletingId === project.id}
                          onClick={() => void removeProject(project)}
                        >
                          {t(locale, 'profileDelete')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="profile-empty">{t(locale, 'profileEmpty')}</p>
              )}
            </section>

            <aside className="profile-card profile-actions">
              {canSaveCurrent ? (
                <form onSubmit={saveCurrent}>
                  <h2>{t(locale, 'profileSaveCurrent')}</h2>
                  <label>
                    {t(locale, 'profileProjectName')}
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder={defaultProjectName}
                      required
                    />
                  </label>
                  {saveError && (
                    <p className="profile-error" role="alert">
                      {saveError}
                    </p>
                  )}
                  <button type="submit" disabled={saveBusy}>
                    {saveBusy ? t(locale, 'profileSaving') : t(locale, 'profileSave')}
                  </button>
                </form>
              ) : (
                <>
                  <h2>{t(locale, 'profileSaveCurrent')}</h2>
                  <p>{t(locale, 'profileEmpty')}</p>
                  <Link className="profile-primary-link" to={CREATE_ROUTE}>
                    {t(locale, 'profileCreate')}
                  </Link>
                </>
              )}
              <button type="button" className="profile-signout" onClick={() => void logOut()}>
                {t(locale, 'signOut')}
              </button>
            </aside>
          </div>
        ) : (
          <section className="profile-card profile-auth">
            <form onSubmit={submitAuth}>
              <h2>{authMode === 'sign-up' ? t(locale, 'createAccount') : t(locale, 'signIn')}</h2>
              {authMode === 'sign-up' && (
                <label>
                  {t(locale, 'fullName')}
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                {t(locale, 'password')}
                <input
                  type="password"
                  minLength={10}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {authError && (
                <p className="profile-error" role="alert">
                  {authError}
                </p>
              )}
              <button type="submit" disabled={authBusy}>
                {authBusy
                  ? t(locale, 'updating')
                  : authMode === 'sign-up'
                    ? t(locale, 'createAccount')
                    : t(locale, 'signIn')}
              </button>
              <button
                type="button"
                className="profile-text-button"
                onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}
              >
                {authMode === 'sign-in' ? t(locale, 'createAccount') : t(locale, 'signIn')}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};
