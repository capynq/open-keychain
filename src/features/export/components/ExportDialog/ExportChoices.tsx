import { t, type Locale } from '../../../../infrastructure/i18n';
import type { ExportActionsState } from '../../model/use-export-actions';

export const ExportChoices = ({
  locale,
  exportState,
  printable,
  onDownload,
}: {
  locale: Locale;
  exportState: ExportActionsState;
  printable: boolean;
  onDownload: Parameters<ExportActionsState['download']> extends infer T
    ? (...args: T extends unknown[] ? T : never) => void
    : never;
}) => {
  const disabled = !printable || exportState.downloading;
  return (
    <div className="export-choice-grid">
      <button type="button" disabled={disabled} onClick={() => onDownload('stl')}>
        <strong>{t(locale, 'exportStl')}</strong>
        <small>{t(locale, 'exportStlDescription')}</small>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDownload('3mf', 'separate-colors')}
      >
        <strong>{t(locale, 'export3mfSeparate')}</strong>
        <small>{t(locale, 'export3mfSeparateDescription')}</small>
      </button>
      <button type="button" disabled={disabled} onClick={() => onDownload('3mf', 'merged')}>
        <strong>{t(locale, 'export3mfMerged')}</strong>
        <small>{t(locale, 'export3mfMergedDescription')}</small>
      </button>
    </div>
  );
};
