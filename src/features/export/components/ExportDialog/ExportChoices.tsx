import { Box, Combine, Layers3 } from 'lucide-react';

import type { Locale } from '../../../../infrastructure/i18n/config';
import type { ExportActionsState } from '../../model/use-export-actions';

import { t } from '../../../../infrastructure/i18n/utils';

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
        <Box className="export-choice-icon" aria-hidden="true" />
        <span className="export-choice-copy">
          <strong>{t(locale, 'exportStl')}</strong>
          <small>{t(locale, 'exportStlDescription')}</small>
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDownload('3mf', 'separate-colors')}
      >
        <Layers3 className="export-choice-icon" aria-hidden="true" />
        <span className="export-choice-copy">
          <strong>{t(locale, 'export3mfSeparate')}</strong>
          <small>{t(locale, 'export3mfSeparateDescription')}</small>
        </span>
      </button>
      <button type="button" disabled={disabled} onClick={() => onDownload('3mf', 'merged')}>
        <Combine className="export-choice-icon" aria-hidden="true" />
        <span className="export-choice-copy">
          <strong>{t(locale, 'export3mfMerged')}</strong>
          <small>{t(locale, 'export3mfMergedDescription')}</small>
        </span>
      </button>
    </div>
  );
};
