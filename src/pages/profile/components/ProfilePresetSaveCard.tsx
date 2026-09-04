import type { SubmitEventHandler } from 'react';

import { Link } from 'react-router';

import { createPath } from '@/shared/lib/create-path';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const ProfilePresetSaveCard = ({
  locale,
  canSaveCurrent,
  presetName,
  saveBusy,
  saveError,
  onPresetNameChange,
  onSave,
  onSignOut,
}: {
  locale: Locale;
  canSaveCurrent: boolean;
  presetName: string;
  saveBusy: boolean;
  saveError?: string;
  onPresetNameChange: (value: string) => void;
  onSave: SubmitEventHandler<HTMLFormElement>;
  onSignOut: () => void;
}) => (
  <aside className="profile-card profile-actions">
    {canSaveCurrent ? (
      <form
        onSubmit={onSave}
        toolname="save-keychain-preset"
        tooldescription="Save reusable keychain settings without the customer name. A person must submit this form."
      >
        <h2>{t(locale, 'presetSaveCurrent')}</h2>
        <p>{t(locale, 'presetPrivacy')}</p>
        <label>
          {t(locale, 'presetName')}
          <input
            name="presetName"
            toolparamdescription="The seller-visible name for the reusable preset."
            value={presetName}
            onChange={(event) => onPresetNameChange(event.target.value)}
            placeholder={t(locale, 'presetNamePlaceholder')}
            required
          />
        </label>
        {saveError && (
          <p className="profile-error" role="alert">
            {saveError}
          </p>
        )}
        <button type="submit" disabled={saveBusy}>
          {saveBusy ? t(locale, 'presetSaving') : t(locale, 'savePreset')}
        </button>
      </form>
    ) : (
      <>
        <h2>{t(locale, 'presetSaveCurrent')}</h2>
        <p>{t(locale, 'presetSaveHint')}</p>
        <Link className="profile-primary-link" to={createPath(locale)}>
          {t(locale, 'presetCreate')}
        </Link>
      </>
    )}
    <button type="button" className="profile-signout" onClick={onSignOut}>
      {t(locale, 'signOut')}
    </button>
  </aside>
);
