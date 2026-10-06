import type { Dispatch, SetStateAction } from 'react';

import { RotateCcw } from 'lucide-react';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import type { QuickSetupDraft } from './model/useQuickSetupDraft';

import styles from './QuickSetupDialog.module.css';

export const ColorStep = ({
  locale,
  draft,
  setDraft,
  initialAppearanceOverrides,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
  initialAppearanceOverrides: { base?: string; relief?: string };
}) => {
  const initial = draft.appearanceOverrides;
  const update = (key: 'base' | 'relief', value: string) =>
    setDraft((current) => ({
      ...current,
      appearanceOverrides: { ...current.appearanceOverrides, [key]: value.toUpperCase() },
    }));

  return (
    <div className={styles.stepContent}>
      <p className={styles.help}>{t(locale, 'wizardColorsHelp')}</p>
      <div className={styles.colorGrid}>
        <div className={styles.colorField}>
          <label htmlFor="setup-base-color">{t(locale, 'baseColor')}</label>
          <input
            id="setup-base-color"
            type="color"
            value={initial.base ?? '#B84838'}
            onChange={(event) => update('base', event.target.value)}
          />
          <code>{initial.base}</code>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => update('base', initialAppearanceOverrides.base ?? '#B84838')}
            aria-label={t(locale, 'resetBaseColor')}
            data-icon-motion="rotate"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.colorField}>
          <label htmlFor="setup-secondary-color">{t(locale, 'secondaryColor')}</label>
          <input
            id="setup-secondary-color"
            type="color"
            value={initial.relief ?? '#FAF4E9'}
            onChange={(event) => update('relief', event.target.value)}
          />
          <code>{initial.relief}</code>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => update('relief', initialAppearanceOverrides.relief ?? '#FAF4E9')}
            aria-label={t(locale, 'resetSecondaryColor')}
            data-icon-motion="rotate"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
