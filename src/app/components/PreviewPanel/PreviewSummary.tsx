import type { GeometryResult } from '../../../domain/keychain';
import { t, type Locale } from '../../../infrastructure/i18n';
import type { PreviewStatus } from '../../../features/preview';

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
}: {
  locale: Locale;
  geometry: { result: GeometryResult | undefined };
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: PreviewModelInfo;
}) => {
  const result = geometry.result;
  const dimensions = result?.dimensions;

  return (
    <section className="preview-summary" aria-label={t(locale, 'modelSummary')}>
      <div className="summary-metrics">
        <div>
          <span>{t(locale, 'dimensions')}</span>
          <strong>
            {dimensions
              ? `${dimensions.widthMm.toFixed(0)} × ${dimensions.heightMm.toFixed(0)} mm`
              : '-'}
          </strong>
        </div>
        <div>
          <span>{t(locale, 'thickness')}</span>
          <strong>{dimensions ? `${dimensions.thicknessMm.toFixed(1)} mm` : '-'}</strong>
        </div>
        <div>
          <span>{t(locale, 'parts')}</span>
          <strong>{result?.solidCount ?? '-'}</strong>
        </div>
      </div>
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
      {status.feedback && !exportOpen && (
        <div className="summary-feedback-row">
          <p
            className="summary-feedback"
            role={status.className === 'attention' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status.feedback}
          </p>
          {status.className === 'attention' && (
            <button
              type="button"
              className="summary-fix-link"
              onClick={() => {
                const controls = document.querySelector<HTMLElement>(
                  `.controls-panel [data-control-group="${status.fixTarget}"]`,
                );
                const fallback = document.querySelector<HTMLElement>('.controls-panel');

                (controls ?? fallback)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                (controls ?? fallback)
                  ?.querySelector<HTMLElement>('input, select, button')
                  ?.focus();
              }}
            >
              {t(locale, 'fixThis')}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
