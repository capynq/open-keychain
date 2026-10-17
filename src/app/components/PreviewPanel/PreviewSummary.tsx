import { useId } from 'react';

import type { GeometryResult, SizeEnvelope } from '../../../domain/keychain/model/types';
import type { PreviewStatus } from '../../../features/preview/model/preview-status';
import type { Locale } from '../../../infrastructure/i18n/config';

import {
  formatAcceptedMaximum,
  formatAcceptedSize,
  formatAcceptedThickness,
  selectAcceptedMetrics,
} from '../../../domain/keychain/model/accepted-metrics';
import { t } from '../../../infrastructure/i18n/utils';

export const PreviewSummary = ({
  locale,
  geometry,
  status,
  exportOpen,
}: {
  locale: Locale;
  geometry: { result: GeometryResult | undefined; sizeEnvelope?: SizeEnvelope };
  status: PreviewStatus;
  exportOpen: boolean;
}) => {
  const titleId = useId();
  const result = geometry.result;
  const metrics = selectAcceptedMetrics(result, geometry.sizeEnvelope);

  return (
    <section className="preview-summary" aria-labelledby={titleId}>
      <h3 id={titleId}>{t(locale, 'printFacts')}</h3>
      <div className="summary-metrics">
        <div>
          <span>{t(locale, 'modelSize')}</span>
          <strong>{metrics ? formatAcceptedSize(metrics) : '-'}</strong>
        </div>
        <div>
          <span>{t(locale, 'thickness')}</span>
          <strong>{metrics ? formatAcceptedThickness(metrics) : '-'}</strong>
        </div>
        <div>
          <span>{t(locale, 'printableParts')}</span>
          <strong>{metrics?.parts ?? '-'}</strong>
        </div>
        <div>
          <span>{t(locale, 'maximumSize')}</span>
          <strong>{metrics ? (formatAcceptedMaximum(metrics) ?? '-') : '-'}</strong>
        </div>
      </div>
      {metrics?.fitsWithinMaximum !== undefined && (
        <p
          className={`summary-fit-status ${metrics.fitsWithinMaximum ? 'summary-fit-status--fits' : 'summary-fit-status--exceeds'}`}
        >
          <span>{t(locale, 'fitsWithinMaximum')}</span>
          <strong>
            {t(locale, metrics.fitsWithinMaximum ? 'fitsMaximumYes' : 'fitsMaximumNo')}
          </strong>
        </p>
      )}
      {status.feedback && !exportOpen && (
        <p
          className="summary-feedback"
          role={status.className === 'attention' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status.feedback}
        </p>
      )}
    </section>
  );
};
