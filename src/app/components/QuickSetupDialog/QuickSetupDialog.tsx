import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  ClipboardCheck,
  Move,
  Palette,
  Ruler,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { FontCategory } from '@/domain/keychain/fonts/catalog';
import type { AcceptedMetrics } from '@/domain/keychain/model/accepted-metrics';
import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeyringOpeningShape, KeyringPresetId } from '@/domain/keychain/model/keyring-presets';
import type { PrintAppearanceOverrides, SizeEnvelope } from '@/domain/keychain/model/types';
import type { QuickSetupChanges } from '@/features/customizer/model/quick-setup';
import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import { ColorStep } from './ColorStep';
import { FontStep } from './FontStep';
import { KeyringPositionStep } from './KeyringPositionStep';
import { KeyringStep } from './KeyringStep';
import {
  getDraftSize,
  type QuickSetupStepId,
  useQuickSetupDraft,
} from './model/useQuickSetupDraft';
import { NameSizeStep } from './NameSizeStep';
import styles from './QuickSetupDialog.module.css';
import { ReviewStep } from './ReviewStep';

type Props = {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onApply: (changes: QuickSetupChanges) => void;
  initialText?: string;
  initialFavoriteCategories?: FontCategory[];
  initialSize?: SizeEnvelope;
  initialAppearanceOverrides?: PrintAppearanceOverrides;
  submitting?: boolean;
  checking?: boolean;
  error?: string;
  acceptedMetrics?: AcceptedMetrics;
  acceptedText?: string;
  supportsKeyring: boolean;
  initialKeyringPreset?: KeyringPresetId;
  initialKeyringPosition?: KeyringPosition;
  initialKeyringOpeningShape?: KeyringOpeningShape;
  initialKeyringWidthMm?: number;
  initialKeyringLengthMm?: number;
};

export const QuickSetupDialog = ({
  locale,
  open,
  onClose,
  onApply,
  initialText = '',
  initialFavoriteCategories = [],
  initialSize,
  initialAppearanceOverrides = { version: 1, base: '#B84838', relief: '#FAF4E9' },
  submitting = false,
  checking = false,
  error,
  acceptedMetrics,
  acceptedText,
  supportsKeyring,
  initialKeyringPreset = 'standard-round',
  initialKeyringPosition = 'left',
  initialKeyringOpeningShape = 'round',
  initialKeyringWidthMm = 5,
  initialKeyringLengthMm = 5,
}: Props) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useQuickSetupDraft({
    open,
    initialText,
    initialSize,
    initialFavoriteCategories,
    initialAppearanceOverrides,
    initialKeyringPreset,
    initialKeyringPosition,
    initialKeyringOpeningShape,
    initialKeyringWidthMm,
    initialKeyringLengthMm,
  });
  const [step, setStep] = useState(0);
  const editing = useRef(false);

  useEffect(() => {
    if (!open) {
      // Reset while hidden so reopening never flashes the previous step.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(0);
      return;
    }
    previousActiveRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editing.current = false;
    // Each new dialog session starts at the first step.

    setStep(0);
    return () => previousActiveRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus();
    const body = dialogRef.current?.querySelector<HTMLElement>('[data-scroll-body]');
    if (body) body.scrollTop = 0;
  }, [open, step]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? current <= 0
          ? focusable.length - 1
          : current - 1
        : current === focusable.length - 1
          ? 0
          : current + 1;
      if (current < 0 || next !== current + (event.shiftKey ? -1 : 1)) {
        event.preventDefault();
        focusable[next]?.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, submitting]);
  if (!open) return null;
  const activeSize = getDraftSize(draft);
  const valid = Boolean(draft.text.trim() && activeSize);
  const steps: QuickSetupStepId[] = supportsKeyring
    ? ['name-size', 'keyring-position', 'keyring-opening', 'fonts', 'colors', 'review']
    : ['name-size', 'fonts', 'colors', 'review'];
  const stepKey = steps[step] ?? 'name-size';
  const titles: Record<QuickSetupStepId, string> = {
    'name-size': 'wizardNameSizeTitle',
    'keyring-position': 'wizardKeyringPositionTitle',
    'keyring-opening': 'wizardKeyringOpeningTitle',
    fonts: 'wizardFontsTitle',
    colors: 'wizardColorsTitle',
    review: 'wizardReviewTitle',
  };
  const icons = {
    'name-size': Ruler,
    'keyring-position': Move,
    'keyring-opening': Circle,
    fonts: Type,
    colors: Palette,
    review: ClipboardCheck,
  };
  const next = () => {
    if (step < steps.length - 1 && (stepKey !== 'name-size' || valid)) {
      const nextStep = editing.current ? steps.length - 1 : step + 1;

      editing.current = false;
      setStep(nextStep);
    }
  };
  const apply = () => {
    if (!submitting && !checking && valid && activeSize)
      onApply({
        text: draft.text.trim(),
        sizeEnvelope: activeSize,
        ...(supportsKeyring
          ? {
              keyringPosition: draft.keyringPosition,
              ...(draft.keyringPreset !== 'custom' ? { keyringPreset: draft.keyringPreset } : {}),
            }
          : {}),
        favoriteFontCategories: draft.favoriteCategories,
        appearanceOverrides: draft.appearanceOverrides,
      });
  };
  const edit = (value: QuickSetupStepId) => {
    if (submitting) return;
    editing.current = true;
    setStep(steps.indexOf(value));
  };
  const StepIcon = icons[stepKey];

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        data-testid="quick-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-setup-title"
      >
        <header className={styles.header}>
          <div className={styles.headingBlock}>
            <div className={styles.progress}>
              <span>
                {t(locale, 'wizardStep')
                  .replace('{step}', String(step + 1))
                  .replace('{total}', String(steps.length))}
              </span>
              <span className={styles.progressDots} aria-hidden="true">
                {steps.map((_, index) => (
                  <i key={index} data-complete={index <= step} />
                ))}
              </span>
            </div>
            <div className={styles.headingLine}>
              <StepIcon />
              <h2 id="quick-setup-title" data-step-title tabIndex={-1}>
                {t(locale, titles[stepKey])}
              </h2>
            </div>
          </div>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t(locale, 'close')}
            data-icon-motion="none"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body} data-scroll-body>
          <div className={styles.stepFrame} key={step}>
            {stepKey === 'name-size' ? (
              <NameSizeStep locale={locale} draft={draft} setDraft={setDraft} />
            ) : stepKey === 'keyring-position' ? (
              <KeyringPositionStep locale={locale} draft={draft} setDraft={setDraft} />
            ) : stepKey === 'keyring-opening' ? (
              <KeyringStep locale={locale} draft={draft} setDraft={setDraft} />
            ) : stepKey === 'fonts' ? (
              <FontStep locale={locale} draft={draft} setDraft={setDraft} />
            ) : stepKey === 'colors' ? (
              <ColorStep
                locale={locale}
                draft={draft}
                setDraft={setDraft}
                initialAppearanceOverrides={initialAppearanceOverrides}
              />
            ) : (
              <ReviewStep
                locale={locale}
                draft={draft}
                onEdit={edit}
                acceptedMetrics={acceptedMetrics}
                acceptedText={acceptedText}
                supportsKeyring={supportsKeyring}
              />
            )}
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={styles.actions}>
          {step > 0 && (
            <button
              type="button"
              className={styles.secondary}
              disabled={submitting}
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft data-icon-motion="nudge" size={17} aria-hidden="true" />
              {t(locale, 'wizardBack')}
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              type="button"
              className={styles.primary}
              disabled={submitting || (stepKey === 'name-size' && !valid)}
              onClick={next}
            >
              {t(locale, 'wizardNext')}
              <ArrowRight data-icon-motion="nudge" size={17} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              aria-disabled={submitting || checking || !valid}
              onClick={apply}
            >
              <Check size={17} aria-hidden="true" />
              {t(locale, submitting || checking ? 'updating' : 'quickSetupApply')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
