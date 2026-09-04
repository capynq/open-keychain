import { Link } from 'react-router';

import type { SellerPreset } from '@/features/hosted/api/hosted-api';

import { createPath } from '@/shared/lib/create-path';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const ProfilePresets = ({
  locale,
  presets,
  deleteError,
  deletingId,
  onUse,
  onDelete,
}: {
  locale: Locale;
  presets: SellerPreset[];
  deleteError?: string;
  deletingId?: string;
  onUse: (preset: SellerPreset) => void;
  onDelete: (preset: SellerPreset) => void;
}) => (
  <section className="profile-card profile-projects" aria-labelledby="saved-presets-title">
    <div className="profile-card-heading">
      <h2 id="saved-presets-title">{t(locale, 'presetLibrary')}</h2>
      <Link to={createPath(locale)}>{t(locale, 'presetCreate')}</Link>
    </div>
    {deleteError && (
      <p className="profile-error" role="alert">
        {deleteError}
      </p>
    )}
    {presets.length ? (
      <ul>
        {presets.map((preset) => (
          <li key={preset.id}>
            <div>
              <strong>{preset.name}</strong>
              <small>{preset.print_profile_id}</small>
            </div>
            <div className="profile-project-actions">
              <button type="button" onClick={() => onUse(preset)}>
                {t(locale, 'presetUse')}
              </button>
              <button
                type="button"
                className="profile-delete"
                disabled={deletingId === preset.id}
                onClick={() => onDelete(preset)}
              >
                {t(locale, 'presetDelete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="profile-empty">{t(locale, 'presetEmpty')}</p>
    )}
  </section>
);
