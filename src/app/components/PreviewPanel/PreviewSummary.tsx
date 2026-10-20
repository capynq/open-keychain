import { useId } from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { recoveryMessage, recoverySteps } from '@/infrastructure/i18n/utils';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

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
  onReview,
}: {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
    sizeEnvelope?: SizeEnvelope;
    failure?: RecoveryFailure;
    retry?: () => void;
  };
  status: PreviewStatus;
  exportOpen: boolean;
  onReview?: () => void;
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
      {status.feedback &&
        !exportOpen &&
        (status.className === 'attention' ? (
          <div className="summary-feedback">
            <RecoveryNotice
              role="alert"
              message={recoveryMessage(
                locale,
                geometry.failure ??
                  status.feedbackIssue?.failure ?? {
                    code: status.feedbackIssue?.code ?? 'unknown-failure',
                  },
              )}
              steps={recoverySteps(
                locale,
                geometry.failure ??
                  status.feedbackIssue?.failure ?? {
                    code: status.feedbackIssue?.code ?? 'unknown-failure',
                  },
              )}
              detailsLabel={t(locale, 'recoveryDetails')}
              diagnostic={geometry.failure?.message ?? status.feedbackIssue?.message}
              actions={[
                ...(geometry.failure && geometry.retry
                  ? [
                      {
                        id: 'retry-generation',
                        label: t(locale, 'recoveryRetry'),
                        onAction: geometry.retry,
                      },
                    ]
                  : []),
                ...(onReview
                  ? [{ id: 'review', label: t(locale, 'recoveryReview'), onAction: onReview }]
                  : []),
              ]}
            />
          </div>
        ) : (
          <p className="summary-feedback" role="status" aria-live="polite">
            {status.feedback}
          </p>
        ))}
    </section>
  );
};
