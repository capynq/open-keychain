import { useEffect, useRef } from 'react';
import { t, type Locale } from '../../../infrastructure/i18n';
import type { ExportActionsState } from '../model/use-export-actions';
import type { PreflightReport } from '../model/preflight';
import type { PrintAppearance } from '../../../domain/keychain';
import { issueMessage } from '../../../infrastructure/i18n';
import { X, RefreshCw } from 'lucide-react';
import { IconButton } from '../../../app/components/IconButton';

export const ExportDialog = ({
  locale,
  open,
  exportState,
  preflight,
  effectiveAppearance,
  onClose,
  onExportSuccess,
}: {
  locale: Locale;
  open: boolean;
  exportState: ExportActionsState;
  preflight: PreflightReport;
  effectiveAppearance?: PrintAppearance;
  onClose: () => void;
  onExportSuccess?: () => void;
}) => {
  const statusLabelKey =
    preflight.status === 'generating'
      ? 'printCheckPending'
      : preflight.status === 'ready-with-warnings'
        ? 'printCheckWarnings'
        : preflight.status === 'blocked'
          ? 'printCheckBlocked'
          : 'printCheckReady';
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
            <p className="eyebrow">{t(locale, 'export')}</p>
            <h2 id="export-title">{t(locale, 'exportTitle')}</h2>
          </div>
          <IconButton
            action="close-export"
            className="modal-close"
            icon={X}
            label={t(locale, 'close')}
            onClick={onClose}
            autoFocus={!exportState.downloading}
            disabled={exportState.downloading}
          />
        </div>
        <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
        <details className="export-preflight" open={preflight.status === 'blocked'}>
          <summary>
            <span>{t(locale, 'exportChecks')}</span>
            <strong>{t(locale, statusLabelKey)}</strong>
          </summary>
          <div className="export-preflight-body">
            {preflight.dimensions && (
              <p>
                <strong>{t(locale, 'dimensions')}:</strong>{' '}
                {preflight.dimensions.widthMm.toFixed(1)} ×{' '}
                {preflight.dimensions.heightMm.toFixed(1)} ×{' '}
                {preflight.dimensions.thicknessMm.toFixed(1)} mm
              </p>
            )}
            {preflight.profile && (
              <p>
                <strong>{t(locale, 'printProfile')}:</strong> {preflight.profile.id} ·{' '}
                {preflight.profile.nozzleDiameterMm.toFixed(1)} {t(locale, 'nozzle')} ·{' '}
                {preflight.profile.layerHeightMm.toFixed(1)} {t(locale, 'layerHeight')}
              </p>
            )}
            {preflight.constraints && (
              <p>
                <strong>{t(locale, 'printLimits')}:</strong> {t(locale, 'minimumWall')}{' '}
                {preflight.constraints.minimumWallMm.toFixed(1)} mm ·{' '}
                {t(locale, 'minimumClearance')}{' '}
                {preflight.constraints.minimumClearanceMm.toFixed(1)} mm ·{' '}
                {t(locale, 'maximumWidth')} {preflight.constraints.maximumWidthMm.toFixed(0)} mm
              </p>
            )}
            {effectiveAppearance && (
              <p>
                <strong>{t(locale, 'printColors')}:</strong>{' '}
                <span
                  className="export-color-chip"
                  style={{ backgroundColor: effectiveAppearance.base.color }}
                />{' '}
                {t(locale, 'baseRole')} ·{' '}
                <span
                  className="export-color-chip"
                  style={{ backgroundColor: effectiveAppearance.relief.color }}
                />{' '}
                {t(locale, 'reliefRole')}
              </p>
            )}
            {preflight.issues.length > 0 && (
              <ul>
                {preflight.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>{issueMessage(locale, issue)}</li>
                ))}
              </ul>
            )}
            <p>{t(locale, 'slicerGuidance')}</p>
          </div>
        </details>
        {!preflight.printable && (
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
        <div className="export-choice-grid">
          <button
            type="button"
            disabled={!preflight.printable || exportState.downloading}
            onClick={() => handleDownload('stl')}
          >
            <strong>{t(locale, 'exportStl')}</strong>
            <small>{t(locale, 'exportStlDescription')}</small>
          </button>
          <button
            type="button"
            disabled={!preflight.printable || exportState.downloading}
            onClick={() => handleDownload('3mf', 'separate-colors')}
          >
            <strong>{t(locale, 'export3mfSeparate')}</strong>
            <small>{t(locale, 'export3mfSeparateDescription')}</small>
          </button>
          <button
            type="button"
            disabled={!preflight.printable || exportState.downloading}
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
