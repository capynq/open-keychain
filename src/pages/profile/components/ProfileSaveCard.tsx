import type { FormEventHandler } from 'react';

import { Link } from 'react-router';

import { CREATE_ROUTE } from '@/app/routes';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const ProfileSaveCard = ({
  locale,
  canSaveCurrent,
  projectName,
  defaultProjectName,
  saveBusy,
  saveError,
  onProjectNameChange,
  onSave,
  onSignOut,
}: {
  locale: Locale;
  canSaveCurrent: boolean;
  projectName: string;
  defaultProjectName: string;
  saveBusy: boolean;
  saveError?: string;
  onProjectNameChange: (value: string) => void;
  onSave: FormEventHandler<HTMLFormElement>;
  onSignOut: () => void;
}) => (
  <aside className="profile-card profile-actions">
    {canSaveCurrent ? (
      <form onSubmit={onSave}>
        <h2>{t(locale, 'profileSaveCurrent')}</h2>
        <label>
          {t(locale, 'profileProjectName')}
          <input
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
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
    <button type="button" className="profile-signout" onClick={onSignOut}>
      {t(locale, 'signOut')}
    </button>
  </aside>
);
