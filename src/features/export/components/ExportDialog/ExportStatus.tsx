import { X } from 'lucide-react';

import { IconButton } from '@/shared/ui/IconButton';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import type { Locale } from '../../../../infrastructure/i18n/config';
import type { ExportActionsState } from '../../model/use-export-actions';

import { recoveryMessage, recoverySteps, t } from '../../../../infrastructure/i18n/utils';

export const ExportStatus = ({
  locale,
  exportState,
  printable,
  onClose,
}: {
  locale: Locale;
  exportState: ExportActionsState;
  printable: boolean;
  onClose: () => void;
}) => (
  <>
    {!printable && (
      <p className="export-inline-state" role="status">
        {t(locale, 'exportUnavailable')}
      </p>
    )}
    {exportState.status === 'exporting' && (
      <p className="export-inline-state exporting" role="status" aria-live="polite">
        {t(locale, 'exporting')}
      </p>
    )}
    {exportState.status === 'success' && (
      <div className="export-inline-state success" role="status" aria-live="polite">
        <p>{t(locale, 'exportCompleted')}</p>
        <IconButton
          action="close-export-success"
          icon={X}
          label={t(locale, 'close')}
          motion="scale"
          onClick={onClose}
        />
      </div>
    )}
    {exportState.status === 'error' && (
      <div className="export-inline-state error">
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(
            locale,
            exportState.failure ?? { code: 'geometry-export-failed', message: exportState.error },
          )}
          detailsLabel={t(locale, 'recoveryDetails')}
          diagnostic={exportState.failure?.message ?? exportState.error}
          steps={recoverySteps(
            locale,
            exportState.failure ?? { code: 'geometry-export-failed', message: exportState.error },
          )}
          actions={[
            {
              id: 'retry-export',
              label: t(locale, 'recoveryRetry'),
              onAction: exportState.retry,
              disabled: exportState.downloading,
            },
          ]}
        />
      </div>
    )}
  </>
);
