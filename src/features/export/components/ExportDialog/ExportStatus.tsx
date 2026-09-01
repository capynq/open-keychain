import { RefreshCw, X } from 'lucide-react';
import { IconButton } from '../../../../app/components/IconButton/IconButton';
import { t, type Locale } from '../../../../infrastructure/i18n';
import type { ExportActionsState } from '../../model/use-export-actions';

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
          onClick={onClose}
        />
      </div>
    )}
    {exportState.status === 'error' && (
      <div className="export-inline-state error" role="alert">
        <p>{t(locale, 'exportFailed')}</p>
        <IconButton
          action="retry-export"
          icon={RefreshCw}
          label={t(locale, 'retry')}
          onClick={() => void exportState.retry()}
        />
      </div>
    )}
  </>
);
