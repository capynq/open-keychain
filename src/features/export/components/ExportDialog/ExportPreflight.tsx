import type { PrintAppearance } from '../../../../domain/keychain/model/types';
import type { Locale } from '../../../../infrastructure/i18n/config';
import type { PreflightReport } from '../../model/preflight';

import {
  formatAcceptedMaximum,
  formatAcceptedSize,
  formatAcceptedThickness,
  type AcceptedMetrics,
} from '../../../../domain/keychain/model/accepted-metrics';
import { issueMessage, t } from '../../../../infrastructure/i18n/utils';

export const ExportPreflight = ({
  locale,
  preflight,
  effectiveAppearance,
  acceptedMetrics,
}: {
  locale: Locale;
  preflight: PreflightReport;
  effectiveAppearance?: PrintAppearance;
  acceptedMetrics?: AcceptedMetrics;
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
    <details
      className={`export-preflight export-preflight--${preflight.status}`}
      open={preflight.status === 'blocked'}
    >
      <summary>
        <span className="export-preflight-marker" aria-hidden="true" />
        <span>{t(locale, 'exportChecks')}</span>
        <strong>{t(locale, statusLabelKey)}</strong>
      </summary>
      <div className="export-preflight-body">
        {acceptedMetrics && (
          <p>
            <strong>{t(locale, 'modelSize')}:</strong> {formatAcceptedSize(acceptedMetrics)} ·{' '}
            <strong>{t(locale, 'thickness')}:</strong> {formatAcceptedThickness(acceptedMetrics)} ·{' '}
            <strong>{t(locale, 'parts')}:</strong> {acceptedMetrics.parts ?? '—'}
          </p>
        )}
        {acceptedMetrics?.fitsWithinMaximum !== undefined && (
          <p>
            <strong>{t(locale, 'fitsWithinMaximum')}:</strong>{' '}
            {formatAcceptedMaximum(acceptedMetrics)} {acceptedMetrics.fitsWithinMaximum ? '✓' : '—'}
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
          <>
            <p>
              <strong>{t(locale, 'printColors')}:</strong>{' '}
              <span
                className="export-color-chip"
                style={{ backgroundColor: effectiveAppearance.base.color }}
              />{' '}
              {t(locale, 'baseRole')} <code>{effectiveAppearance.base.color}</code> ·{' '}
              <span
                className="export-color-chip"
                style={{ backgroundColor: effectiveAppearance.relief.color }}
              />{' '}
              {t(locale, 'reliefRole')} <code>{effectiveAppearance.relief.color}</code>
            </p>
            <p>{t(locale, 'exportColorGuidance')}</p>
          </>
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
