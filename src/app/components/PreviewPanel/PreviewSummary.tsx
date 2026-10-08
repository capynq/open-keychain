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

export type PreviewModelInfo = {
  templateId: string;
  template: string;
  style: string | undefined;
  font: string;
};

export const PreviewSummary = ({
  locale,
  geometry,
  status,
  exportOpen,
  modelInfo,
  neutral = false,
}: {
  locale: Locale;
  geometry: { result: GeometryResult | undefined; sizeEnvelope?: SizeEnvelope };
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: PreviewModelInfo;
  neutral?: boolean;
}) => {
  const result = geometry.result;
  const metrics = selectAcceptedMetrics(result, geometry.sizeEnvelope);

  return (
    <section className="preview-summary" aria-label={t(locale, 'modelSummary')}>
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
          <span>{t(locale, 'parts')}</span>
          <strong>{metrics?.parts ?? '-'}</strong>
        </div>
      </div>
      {metrics?.fitsWithinMaximum !== undefined && (
        <p className="summary-fit-status">
          <span>{t(locale, 'fitsWithinMaximum')}</span>
          <strong>
            {formatAcceptedMaximum(metrics)} {metrics.fitsWithinMaximum ? '✓' : '—'}
          </strong>
        </p>
      )}
      {metrics?.fitsWithinMaximum === undefined && (
        <p className="summary-fit-status summary-fit-status-placeholder" aria-hidden="true">
          <span>{t(locale, 'fitsWithinMaximum')}</span>
          <strong>&nbsp;</strong>
        </p>
      )}
      {!neutral && (
        <div className="summary-tags">
          <span>
            <small>{t(locale, 'modelTemplate')}</small>
            {modelInfo.template}
          </span>
          {modelInfo.style && (
            <span>
              <small>{t(locale, 'modelStyle')}</small>
              {modelInfo.style}
            </span>
          )}
          <span>
            <small>{t(locale, 'modelFont')}</small>
            {modelInfo.font}
          </span>
        </div>
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
