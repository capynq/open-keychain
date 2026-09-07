import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { IconButton } from '@/shared/ui/IconButton';

import type { PrintAppearance } from '../../../../domain/keychain/model/types';
import type { Locale } from '../../../../infrastructure/i18n/config';
import type { PreflightReport } from '../../model/preflight';
import type { ExportActionsState } from '../../model/use-export-actions';

import { t } from '../../../../infrastructure/i18n/utils';
import { ExportChoices } from './ExportChoices';
import { ExportPreflight } from './ExportPreflight';
import { ExportStatus } from './ExportStatus';
import './ExportDialog.css';

export const ExportDialog = ({
  locale,
  open,
  exportState,
  preflight,
  effectiveAppearance,
  onClose,
  onExportSuccess,
  disconnectedExportAcknowledged,
  onDisconnectedExportAcknowledged,
}: {
  locale: Locale;
  open: boolean;
  exportState: ExportActionsState;
  preflight: PreflightReport;
  effectiveAppearance?: PrintAppearance;
  onClose: () => void;
  onExportSuccess?: () => void;
  disconnectedExportAcknowledged: boolean;
  onDisconnectedExportAcknowledged: (acknowledged: boolean) => void;
}) => {
  const wasOpen = useRef(false);
  const reportedSuccess = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    if (justOpened) {
      exportState.clearStatus();
      reportedSuccess.current = false;
    }
    if (!open) reportedSuccess.current = false;
    if (!justOpened && open && exportState.status === 'success' && !reportedSuccess.current) {
      reportedSuccess.current = true;
      onExportSuccess?.();
    }
    wasOpen.current = open;
  }, [exportState, onExportSuccess, open]);
  if (!open) return null;
  const handleDownload = (
    format: Parameters<ExportActionsState['download']>[0],
    mode?: Parameters<ExportActionsState['download']>[1],
  ): void => {
    void exportState.download(format, mode);
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="export-modal-heading">
          <div>
            <h2 id="export-title">{t(locale, 'exportTitle')}</h2>
          </div>
          <IconButton
            action="close-export"
            className="modal-close"
            icon={X}
            label={t(locale, 'close')}
            motion="scale"
            onClick={onClose}
            autoFocus={!exportState.downloading}
            disabled={exportState.downloading}
          />
        </div>
        <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
        <ExportPreflight
          locale={locale}
          preflight={preflight}
          effectiveAppearance={effectiveAppearance}
        />
        {preflight.issues.some(
          (issue) => issue.code === 'disconnected' && issue.severity === 'error',
        ) && (
          <label className="export-separate-confirmation">
            <input
              type="checkbox"
              checked={disconnectedExportAcknowledged}
              onChange={(event) => onDisconnectedExportAcknowledged(event.target.checked)}
            />
            <span>{t(locale, 'exportSeparatePartsAcknowledge')}</span>
          </label>
        )}
        <ExportStatus
          locale={locale}
          exportState={exportState}
          printable={preflight.printable}
          onClose={onClose}
        />
        <ExportChoices
          locale={locale}
          exportState={exportState}
          printable={preflight.printable}
          onDownload={handleDownload}
        />
      </section>
    </div>
  );
};
