import { Copy } from 'lucide-react';
import { useId, type ReactElement } from 'react';

import { PopoverAction } from '@/shared/ui/PopoverAction';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import type { Locale } from '../../../infrastructure/i18n/config';
import type { ShareDesignApi } from '../useShareDesign';

import { recoveryMessage, recoverySteps, t } from '../../../infrastructure/i18n/utils';
import styles from './SharePopover.module.css';

const shareStatusMessage = (
  locale: Locale,
  status: ShareDesignApi['feedback']['status'],
): string => {
  if (status === 'native-completed') return t(locale, 'shareCompleted');

  if (status === 'preparing') return t(locale, 'sharePreparing');

  if (status === 'manual') return t(locale, 'shareManual');

  return '';
};

export const ShareFeedback = ({
  locale,
  share,
  fontFallback,
  disabled,
  onCopy,
  onNative,
}: {
  locale: Locale;
  share: ShareDesignApi;
  fontFallback: boolean;
  disabled: boolean;
  onCopy: () => void;
  onNative: () => void;
}): ReactElement => {
  const manualInputId = useId();
  const feedback = share.feedback;
  const { status } = feedback;

  return (
    <>
      <p className={styles.status} role="status" aria-live="polite">
        {shareStatusMessage(locale, status)}
      </p>
      {(fontFallback || share.shareFontFallback) && (
        <p className={styles.hint}>{t(locale, 'shareFontFallback')}</p>
      )}
      {status === 'manual' && (
        <div className={styles.manual}>
          <label htmlFor={manualInputId}>{t(locale, 'shareManualPrompt')}</label>
          <input
            id={manualInputId}
            className={styles.input}
            readOnly
            value={feedback.url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <PopoverAction
            kind="button"
            icon={Copy}
            label={t(locale, 'copyLink')}
            onClick={onCopy}
            disabled={disabled}
          />
        </div>
      )}
      {status === 'failed' && (
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(locale, feedback.failure)}
          detailsLabel={t(locale, 'recoveryDetails')}
          diagnostic={feedback.failure.message}
          steps={recoverySteps(locale, feedback.failure)}
          actions={[
            {
              id: 'copy-share-link',
              label: t(locale, 'copyLink'),
              onAction: onCopy,
              disabled,
            },
          ]}
        />
      )}
      {status === 'native-failed' && (
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(locale, feedback.failure)}
          detailsLabel={t(locale, 'recoveryDetails')}
          diagnostic={feedback.failure.message}
          steps={recoverySteps(locale, feedback.failure)}
          actions={[
            ...(share.canShareViaDevice
              ? [
                  {
                    id: 'retry-native-share',
                    label: t(locale, 'shareViaDevice'),
                    onAction: onNative,
                    disabled,
                  },
                ]
              : []),
            {
              id: 'copy-share-link',
              label: t(locale, 'copyLink'),
              onAction: onCopy,
              disabled,
            },
          ]}
        />
      )}
    </>
  );
};
