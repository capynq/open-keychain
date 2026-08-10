import type { ExportFormat, ThreeMfMode } from '../../../domain/keychain';
import { t, type Locale } from '../../../infrastructure/i18n';

export const ExportDialog = ({
  locale,
  open,
  printable,
  downloading,
  onClose,
  onDownload,
}: {
  locale: Locale;
  open: boolean;
  printable: boolean;
  downloading: boolean;
  onClose: () => void;
  onDownload: (format: ExportFormat, mode?: ThreeMfMode) => void;
}) => {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="export-modal-heading">
          <div>
            <p className="eyebrow">{t(locale, 'export')}</p>
            <h2 id="export-title">{t(locale, 'exportTitle')}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t(locale, 'close')} autoFocus>
            ×
          </button>
        </div>
        <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
        <div className="export-choice-grid">
          <button type="button" disabled={!printable || downloading} onClick={() => onDownload('stl')}>
            <strong>{t(locale, 'exportStl')}</strong>
            <small>{t(locale, 'exportStlDescription')}</small>
          </button>
          <button
            type="button"
            disabled={!printable || downloading}
            onClick={() => onDownload('3mf', 'separate-colors')}
          >
            <strong>{t(locale, 'export3mfSeparate')}</strong>
            <small>{t(locale, 'export3mfSeparateDescription')}</small>
          </button>
          <button type="button" disabled={!printable || downloading} onClick={() => onDownload('3mf', 'merged')}>
            <strong>{t(locale, 'export3mfMerged')}</strong>
            <small>{t(locale, 'export3mfMergedDescription')}</small>
          </button>
        </div>
      </section>
    </div>
  );
};
