import { useState } from 'react';

import type {
  CandidateFeedback,
  useCustomizerParams,
} from '@/features/customizer/hooks/useCustomizerParams';
import type { Locale } from '@/infrastructure/i18n/config';

import { recoveryMessage, recoverySteps, t } from '@/infrastructure/i18n/utils';
import { AnchoredPopover } from '@/shared/ui/AnchoredPopover';
import { RecoveryNotice, type RecoveryNoticeAction } from '@/shared/ui/RecoveryNotice';

export const CandidateRecovery = ({
  locale,
  customizer,
  feedback,
  onReview,
  inline = false,
}: {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  feedback: CandidateFeedback;
  onReview: () => void;
  inline?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const failure = feedback.failure ?? { code: 'unknown-failure' };
  const actions: RecoveryNoticeAction[] = customizer.recoveryOptions.map((option) => ({
    id: option.id,
    label: t(locale, option.labelKey, option.values),
    disabled: option.status !== 'ready',
    busy: option.status === 'checking',
    onAction: () => {
      if (customizer.applyRecovery(feedback.requestId, option.id)) setOpen(false);
      else void customizer.prepareRecovery(feedback.requestId);
    },
  }));
  if (feedback.status === 'failed') {
    return (
      <div
        className="candidate-feedback candidate-feedback-rejected"
        data-recovery-code={failure.code}
      >
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(locale, failure)}
          detailsLabel={t(locale, 'recoveryDetails')}
          diagnostic={feedback.diagnostic}
          actions={[
            {
              id: 'retry',
              label: t(locale, 'recoveryRetry'),
              onAction: () => customizer.retryCandidate(feedback.requestId),
            },
          ]}
        />
      </div>
    );
  }
  actions.push({
    id: 'review',
    label: t(locale, 'recoveryReview'),
    onAction: () => {
      setOpen(false);
      onReview();
    },
  });
  if (inline)
    return (
      <div
        className="candidate-feedback candidate-feedback-rejected"
        data-recovery-code={failure.code}
      >
        <p role="alert">{recoveryMessage(locale, failure)}</p>
        <button
          type="button"
          className="candidate-review-action"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            if (!open) void customizer.prepareRecovery(feedback.requestId);
            else customizer.cancelRecovery();
          }}
        >
          {t(locale, 'recoveryFix')}
        </button>
        {open && (
          <>
            <RecoveryNotice
              message={t(locale, 'recoveryRetainAttempt')}
              steps={recoverySteps(locale, failure)}
              actions={actions}
              diagnostic={feedback.diagnostic}
              detailsLabel={t(locale, 'recoveryDetails')}
            />
            {!customizer.recoveryChecking &&
              customizer.recoveryOptions.length > 0 &&
              customizer.recoveryOptions.every((option) => option.status === 'unavailable') && (
                <p role="status">{t(locale, 'recoveryUnavailable')}</p>
              )}
          </>
        )}
      </div>
    );
  return (
    <div
      className="candidate-feedback candidate-feedback-rejected"
      data-recovery-code={failure.code}
    >
      <p role="alert">{recoveryMessage(locale, failure)}</p>
      <AnchoredPopover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void customizer.prepareRecovery(feedback.requestId);
          else customizer.cancelRecovery();
        }}
        label={t(locale, 'recoveryOptions')}
        placement="bottom-end"
        trigger={(props) => (
          <button {...props} type="button" className="candidate-review-action">
            {t(locale, 'recoveryFix')}
          </button>
        )}
      >
        <RecoveryNotice
          message={t(locale, 'recoveryRetainAttempt')}
          steps={recoverySteps(locale, failure)}
          actions={actions}
          diagnostic={feedback.diagnostic}
          detailsLabel={t(locale, 'recoveryDetails')}
        />
        {!customizer.recoveryChecking &&
          customizer.recoveryOptions.length > 0 &&
          customizer.recoveryOptions.every((option) => option.status === 'unavailable') && (
            <p role="status">{t(locale, 'recoveryUnavailable')}</p>
          )}
      </AnchoredPopover>
    </div>
  );
};
