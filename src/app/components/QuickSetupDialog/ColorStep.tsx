import type { Dispatch, SetStateAction } from 'react';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';
import { ColorControl } from '@/shared/ui/ColorControl';

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
        <ColorControl
          label={t(locale, 'baseColor')}
          value={initial.base ?? '#B84838'}
          fallback="#B84838"
          resetLabel={t(locale, 'resetBaseColor')}
          onChange={(value) => update('base', value)}
          onReset={() => update('base', initialAppearanceOverrides.base ?? '#B84838')}
        />
        <ColorControl
          label={t(locale, 'secondaryColor')}
          value={initial.relief ?? '#FAF4E9'}
          fallback="#FAF4E9"
          resetLabel={t(locale, 'resetSecondaryColor')}
          onChange={(value) => update('relief', value)}
          onReset={() => update('relief', initialAppearanceOverrides.relief ?? '#FAF4E9')}
        />
      </div>
    </div>
  );
};
