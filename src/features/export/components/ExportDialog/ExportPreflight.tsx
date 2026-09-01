import type { PrintAppearance } from '../../../../domain/keychain';
import type { Locale } from '../../../../infrastructure/i18n';
import type { PreflightReport } from '../../model/preflight';

import { issueMessage, t } from '../../../../infrastructure/i18n';

export const ExportPreflight = ({
  locale,
  preflight,
  effectiveAppearance,
}: {
  locale: Locale;
  preflight: PreflightReport;
  effectiveAppearance?: PrintAppearance;
}) => {
  const statusLabelKey =
    preflight.status === 'generating'
      ? 'printCheckPending'
      : preflight.status === 'ready-with-warnings'
        ? 'printCheckWarnings'
        : preflight.status === 'blocked'
          ? 'printCheckBlocked'
          : 'printCheckReady';

  return (
    <details className="export-preflight" open={preflight.status === 'blocked'}>
      <summary>
        <span>{t(locale, 'exportChecks')}</span>
        <strong>{t(locale, statusLabelKey)}</strong>
      </summary>
      <div className="export-preflight-body">
        {preflight.dimensions && (
          <p>
            <strong>{t(locale, 'dimensions')}:</strong> {preflight.dimensions.widthMm.toFixed(1)}{' '}
            {t(locale, 'dimensionSeparator')} {preflight.dimensions.heightMm.toFixed(1)}{' '}
            {t(locale, 'dimensionSeparator')} {preflight.dimensions.thicknessMm.toFixed(1)}{' '}
            {t(locale, 'millimeterUnit')}
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
            {preflight.constraints.minimumWallMm.toFixed(1)} {t(locale, 'millimeterUnit')}{' '}
            {t(locale, 'listSeparator')} {t(locale, 'minimumClearance')}{' '}
            {preflight.constraints.minimumClearanceMm.toFixed(1)} {t(locale, 'millimeterUnit')}{' '}
            {t(locale, 'listSeparator')} {t(locale, 'maximumWidth')}{' '}
            {preflight.constraints.maximumWidthMm.toFixed(0)} {t(locale, 'millimeterUnit')}
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
  );
};
