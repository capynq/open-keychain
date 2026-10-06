import { Pencil } from 'lucide-react';

import type { AcceptedMetrics } from '@/domain/keychain/model/accepted-metrics';
import type { Locale } from '@/infrastructure/i18n';

import {
  formatAcceptedSize,
  formatAcceptedThickness,
} from '@/domain/keychain/model/accepted-metrics';
import { keyringPositionNameKey } from '@/domain/keychain/model/keyring-position';
import { keyringPresetNameKey } from '@/domain/keychain/model/keyring-presets';
import { t } from '@/infrastructure/i18n';

import type { QuickSetupDraft, QuickSetupStepId } from './model/useQuickSetupDraft';

import { getDraftSize } from './model/useQuickSetupDraft';
import styles from './QuickSetupDialog.module.css';

export const ReviewStep = ({
  locale,
  draft,
  onEdit,
  acceptedMetrics,
  acceptedText,
  supportsKeyring,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  onEdit: (step: QuickSetupStepId) => void;
  acceptedMetrics?: AcceptedMetrics;
  acceptedText?: string;
  supportsKeyring: boolean;
}) => (
  <div className={styles.stepContent}>
    <p className={styles.help}>{t(locale, 'wizardReviewHelp')}</p>
    <div className={styles.reviewList}>
      <div className={styles.reviewRow}>
        <div>
          <strong>{t(locale, 'wizardNameSizeTitle')}</strong>
          <span>
            {draft.text.trim()} · {t(locale, 'wizardMaximumSize')}:{' '}
            {getDraftSize(draft) ? formatAcceptedSize(getDraftSize(draft)!) : '—'}
          </span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onEdit('name-size')}
          aria-label={t(locale, 'wizardEditNameSize')}
          data-icon-motion="nudge"
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </div>
      {acceptedMetrics &&
        acceptedText?.trim() === draft.text.trim() &&
        acceptedMetrics.maximum &&
        (() => {
          const draftSize = getDraftSize(draft);

          return (
            draftSize &&
            draftSize.widthMm === acceptedMetrics.maximum.widthMm &&
            draftSize.heightMm === acceptedMetrics.maximum.heightMm
          );
        })() && (
          <div className={styles.reviewRow}>
            <div>
              <strong>{t(locale, 'wizardAcceptedSizeTitle')}</strong>
              <span>
                {formatAcceptedSize(acceptedMetrics)} · {formatAcceptedThickness(acceptedMetrics)} ·{' '}
                {acceptedMetrics.parts ?? '—'} {t(locale, 'parts').toLowerCase()}
              </span>
            </div>
          </div>
        )}
      {supportsKeyring && (
        <div className={styles.reviewRow}>
          <div>
            <strong>{t(locale, 'wizardKeyringPositionTitle')}</strong>
            <span>{t(locale, keyringPositionNameKey(draft.keyringPosition))}</span>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onEdit('keyring-position')}
            aria-label={t(locale, 'wizardEditKeyringPosition')}
            data-icon-motion="nudge"
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {supportsKeyring && (
        <div className={styles.reviewRow}>
          <div>
            <strong>{t(locale, 'wizardKeyringOpeningTitle')}</strong>
            <span>
              {t(locale, keyringPresetNameKey(draft.keyringPreset))} ·{' '}
              {draft.keyringOpeningShape === 'slot'
                ? `${draft.keyringWidthMm} × ${draft.keyringLengthMm} mm`
                : `${draft.keyringWidthMm} mm`}
            </span>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onEdit('keyring-opening')}
            aria-label={t(locale, 'wizardEditKeyringOpening')}
            data-icon-motion="nudge"
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={styles.reviewRow}>
        <div>
          <strong>{t(locale, 'wizardFontsTitle')}</strong>
          <span>
            {draft.favoriteCategories.length
              ? draft.favoriteCategories
                  .map((category) => t(locale, `fontCategory${category.replace(/[^A-Za-z]/g, '')}`))
                  .join(', ')
              : t(locale, 'wizardAllFonts')}
          </span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onEdit('fonts')}
          aria-label={t(locale, 'wizardEditFonts')}
          data-icon-motion="nudge"
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.reviewRow}>
        <div>
          <strong>{t(locale, 'wizardColorsTitle')}</strong>
          <span className={styles.reviewColors}>
            <span>
              <i
                aria-hidden="true"
                className={styles.swatch}
                style={{ background: draft.appearanceOverrides.base }}
              />
              {draft.appearanceOverrides.base}
            </span>
            <span>
              <i
                aria-hidden="true"
                className={styles.swatch}
                style={{ background: draft.appearanceOverrides.relief }}
              />
              {draft.appearanceOverrides.relief}
            </span>
          </span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onEdit('colors')}
          aria-label={t(locale, 'wizardEditColors')}
          data-icon-motion="nudge"
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
);
