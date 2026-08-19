import { useEffect, useRef } from 'react';
import { t, type Locale } from '../../../infrastructure/i18n';
import type { ExportActionsState } from '../model/use-export-actions';

export const ExportDialog = ({
  locale,
  open,
  exportState,
  onClose,
}: {
  locale: Locale;
  open: boolean;
  exportState: ExportActionsState;
  onClose: () => void;
}) => {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) exportState.clearStatus();
    wasOpen.current = open;
  }, [exportState, open]);
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
            <p className="eyebrow">{t(locale, 'export')}</p>
            <h2 id="export-title">{t(locale, 'exportTitle')}</h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t(locale, 'close')}
            autoFocus={!exportState.downloading}
            disabled={exportState.downloading}
          >
            ×
          </button>
        </div>
        <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
        {!exportState.printable && (
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
            <button type="button" onClick={onClose}>
              {t(locale, 'close')}
            </button>
          </div>
        )}
        {exportState.status === 'error' && (
          <div className="export-inline-state error" role="alert">
            <p>{t(locale, 'exportFailed')}</p>
            <button type="button" onClick={() => void exportState.retry()}>
              {t(locale, 'retry')}
            </button>
          </div>
        )}
        <div className="export-choice-grid">
          <button
            type="button"
            disabled={!exportState.printable || exportState.downloading}
            onClick={() => handleDownload('stl')}
          >
            <strong>{t(locale, 'exportStl')}</strong>
            <small>{t(locale, 'exportStlDescription')}</small>
          </button>
          <button
            type="button"
            disabled={!exportState.printable || exportState.downloading}
            onClick={() => handleDownload('3mf', 'separate-colors')}
          >
            <strong>{t(locale, 'export3mfSeparate')}</strong>
            <small>{t(locale, 'export3mfSeparateDescription')}</small>
          </button>
          <button
            type="button"
            disabled={!exportState.printable || exportState.downloading}
            onClick={() => handleDownload('3mf', 'merged')}
          >
            <strong>{t(locale, 'export3mfMerged')}</strong>
            <small>{t(locale, 'export3mfMergedDescription')}</small>
          </button>
        </div>
      </section>
    </div>
  );
};
