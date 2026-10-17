import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { IconButton } from '@/shared/ui/IconButton';

import type { AcceptedMetrics } from '../../../../domain/keychain/model/accepted-metrics';
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
  acceptedMetrics,
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
  acceptedMetrics?: AcceptedMetrics;
  onClose: () => void;
  onExportSuccess?: () => void;
  disconnectedExportAcknowledged: boolean;
  onDisconnectedExportAcknowledged: (acknowledged: boolean) => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const printableWhenClosed = useRef(preflight.printable);
  const wasOpen = useRef(false);
  const reportedSuccess = useRef(false);

  useEffect(() => {
    if (!open) printableWhenClosed.current = preflight.printable;
  }, [open, preflight.printable]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const initialFocus = printableWhenClosed.current
      ? dialog.querySelector<HTMLButtonElement>('.export-choice-grid button:not(:disabled)')
      : dialog.querySelector<HTMLButtonElement>('.modal-close');
    initialFocus?.focus();

    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [open]);

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
    <dialog
      ref={dialogRef}
      className="export-modal"
      aria-modal="true"
      aria-labelledby="export-title"
      aria-busy={exportState.downloading}
      onCancel={(event) => {
        event.preventDefault();
        if (!exportState.downloading) onClose();
      }}
      onClick={(event) => {
        if (exportState.downloading || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        const active = document.activeElement;

        if (!first || !last) return;
        if (event.shiftKey && (active === first || !dialog.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }}
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
          disabled={exportState.downloading}
        />
      </div>
      <div className="export-modal-body">
        <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
        <ExportPreflight
          locale={locale}
          preflight={preflight}
          effectiveAppearance={effectiveAppearance}
          acceptedMetrics={acceptedMetrics}
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
      </div>
    </dialog>
  );
};
