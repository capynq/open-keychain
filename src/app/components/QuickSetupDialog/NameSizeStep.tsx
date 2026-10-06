import type { Dispatch, SetStateAction } from 'react';

import { Box } from 'lucide-react';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import { SIZE_PRESETS, type QuickSetupDraft } from './model/useQuickSetupDraft';
import styles from './QuickSetupDialog.module.css';

export const NameSizeStep = ({
  locale,
  draft,
  setDraft,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
}) => {
  const customSelected = draft.sizeChoice === 'custom';
  const customValid =
    customSelected &&
    Number.isFinite(Number(draft.customWidth)) &&
    Number.isFinite(Number(draft.customHeight)) &&
    Number(draft.customWidth) >= 20 &&
    Number(draft.customWidth) <= 120 &&
    Number(draft.customHeight) >= 15 &&
    Number(draft.customHeight) <= 80;

  return (
    <div className={styles.stepContent}>
      <label className={styles.field}>
        <span>{t(locale, 'nameInput')}</span>
        <input
          autoComplete="off"
          maxLength={24}
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
          placeholder={t(locale, 'namePlaceholder')}
        />
      </label>
      <fieldset className={styles.sizes}>
        <legend>{t(locale, 'wizardSizeLabel')}</legend>
        <p className={styles.help}>{t(locale, 'wizardNameSizeHelp')}</p>
        <div className={styles.sizeGrid}>
          {SIZE_PRESETS.map((preset, index) => {
            const value = `${preset.widthMm}x${preset.heightMm}`;

            return (
              <label className={styles.sizeOption} key={value}>
                <input
                  type="radio"
                  name="quick-setup-size"
                  checked={draft.sizeChoice === value}
                  onChange={() => setDraft((current) => ({ ...current, sizeChoice: value }))}
                />
                <Box className={styles.sizeCube} aria-hidden="true" />
                <strong>{['XS', 'S', 'M', 'L', 'XL'][index]}</strong>
                <span>
                  {preset.widthMm} × {preset.heightMm} <small>{t(locale, 'millimeterUnit')}</small>
                </span>
              </label>
            );
          })}
        </div>
        <label className={styles.customOption}>
          <input
            type="radio"
            name="quick-setup-size"
            checked={customSelected}
            onChange={() => setDraft((current) => ({ ...current, sizeChoice: 'custom' }))}
          />
          <span>{t(locale, 'wizardCustomSize')}</span>
        </label>
        {customSelected && (
          <div className={styles.customSize}>
            <label>
              <span>{t(locale, 'wizardWidth')}</span>
              <input
                inputMode="decimal"
                value={draft.customWidth}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, customWidth: event.target.value }))
                }
                aria-invalid={!customValid}
              />
            </label>
            <span aria-hidden="true">×</span>
            <label>
              <span>{t(locale, 'wizardHeight')}</span>
              <input
                inputMode="decimal"
                value={draft.customHeight}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, customHeight: event.target.value }))
                }
                aria-invalid={!customValid}
              />
            </label>
          </div>
        )}
        {customSelected && !customValid && (
          <p className={styles.error} role="alert">
            {t(locale, 'quickSetupSizeError')}
          </p>
        )}
      </fieldset>
    </div>
  );
};
