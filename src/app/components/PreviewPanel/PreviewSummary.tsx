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

type SummaryGeometry = {
  result: GeometryResult | undefined;
  sizeEnvelope?: SizeEnvelope;
  failure?: RecoveryFailure;
  retry?: () => void;
};

/**
 * One line of real-world measurements beside the preview title. Part count and the size-envelope
 * check appear only when they say something: several printed parts, or a chosen maximum size.
 */
export const PreviewReadout = ({
  locale,
  geometry,
  pending,
}: {
  locale: Locale;
  geometry: SummaryGeometry;
  pending: boolean;
}) => {
  const metrics = selectAcceptedMetrics(geometry.result, geometry.sizeEnvelope);
  if (!metrics) return null;
  const maximum = formatAcceptedMaximum(metrics);

  return (
    <p
      className="preview-readout"
      data-pending={pending ? 'true' : undefined}
      data-testid="preview-readout"
    >
      <span className="sr-only">{t(locale, 'previewSizeLabel')}: </span>
      <strong>{formatAcceptedSize(metrics)}</strong>
      <span>{t(locale, 'previewThickness', { thickness: formatAcceptedThickness(metrics) })}</span>
      {metrics.parts !== undefined && metrics.parts > 1 && (
        <span>{t(locale, 'previewParts', { count: metrics.parts })}</span>
      )}
      {maximum && metrics.fitsWithinMaximum !== undefined && (
        <span
          className={`preview-readout-fit preview-readout-fit--${metrics.fitsWithinMaximum ? 'fits' : 'exceeds'}`}
        >
          {t(locale, metrics.fitsWithinMaximum ? 'previewFits' : 'previewExceeds', {
            size: maximum,
          })}
        </span>
      )}
    </p>
  );
};

/** Shown under the preview only when the last check produced something to act on. */
export const PreviewSummary = ({
  locale,
  geometry,
  status,
  exportOpen,
  onReview,
}: {
  locale: Locale;
  geometry: SummaryGeometry;
  status: PreviewStatus;
  exportOpen: boolean;
  onReview?: () => void;
}) => {
  if (!status.feedback || exportOpen) return null;
  const failure = geometry.failure ??
    status.feedbackIssue?.failure ?? { code: status.feedbackIssue?.code ?? 'unknown-failure' };

  if (status.className === 'attention')
    return (
      <div className="preview-notice preview-notice--attention" data-testid="preview-notice">
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(locale, failure)}
          steps={recoverySteps(locale, failure)}
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
    );

  return (
    <div className="preview-notice preview-notice--adjusted" data-testid="preview-notice">
      <p role="status" aria-live="polite">
        {status.feedback}
      </p>
      {onReview && (
        <button type="button" className="preview-notice-action" onClick={onReview}>
          {t(locale, 'recoveryReview')}
        </button>
      )}
    </div>
  );
};
