import type { Locale } from '@/infrastructure/i18n/config';

import { recoveryMessage, recoverySteps, t } from '@/infrastructure/i18n/utils';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import { Toast } from '../Toast/Toast';

export const CustomizerNotices = ({
  locale,
  invalidDesign,
  fontFallback,
  randomizeFailure,
  recoveryApplied,
  onNewDesign,
  onRetryRandomize,
}: {
  locale: Locale;
  invalidDesign: boolean;
  fontFallback: boolean;
  randomizeFailure: boolean;
  recoveryApplied: boolean;
  onNewDesign: () => void;
  onRetryRandomize: () => void;
}) => {
  const failure = invalidDesign
    ? { code: 'invalid-design' }
    : randomizeFailure
      ? { code: 'randomize-failed' }
      : undefined;

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {recoveryApplied ? t(locale, 'recoveryFixed') : ''}
      </span>
      {failure ? (
        <Toast variant="error" announce={false}>
          <RecoveryNotice
            role="alert"
            message={recoveryMessage(locale, failure)}
            steps={recoverySteps(locale, failure)}
            detailsLabel={t(locale, 'recoveryDetails')}
            actions={
              invalidDesign
                ? [
                    {
                      id: 'discard-link',
                      label: t(locale, 'recoveryNewDesign'),
                      onAction: onNewDesign,
                    },
                  ]
                : [
                    {
                      id: 'retry-randomize',
                      label: t(locale, 'recoveryRetry'),
                      onAction: onRetryRandomize,
                    },
                  ]
            }
          />
        </Toast>
      ) : fontFallback ? (
        <Toast variant="success">{t(locale, 'shareFontFallback')}</Toast>
      ) : null}
    </>
  );
};
