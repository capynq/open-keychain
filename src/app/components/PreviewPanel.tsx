import { Viewer, type SurfacePresetId } from '../../features/preview';
import type { GeometryResult } from '../../domain/keychain';
import { t, type Locale } from '../../infrastructure/i18n';

export const PreviewPanel = ({
  locale,
  text,
  result,
  busy,
  surfacePreset,
  feedback,
  statusClass,
  statusText,
}: {
  locale: Locale;
  text: string;
  result: GeometryResult | undefined;
  busy: boolean;
  surfacePreset: SurfacePresetId;
  feedback: string | undefined;
  statusClass: string;
  statusText: string;
}) => (
  <section className="preview-panel">
    <div className="preview-heading">
      <div>
        <p className="eyebrow">{t(locale, 'livePreview')}</p>
        <h2>{text || t(locale, 'title')}</h2>
      </div>
      <span className={`status-pill ${statusClass}`}>{statusText}</span>
    </div>
    <div className="viewer-wrap">
      <Viewer result={result} surfacePreset={surfacePreset} locale={locale} />
      {busy && <div className="viewer-loading">{t(locale, 'updating')}</div>}
    </div>
    <div className="preview-footer">
      <div className="dimensions">
        {result && result.dimensions.widthMm > 0 ? (
          <>
            <span>
              {result.dimensions.widthMm.toFixed(0)} × {result.dimensions.heightMm.toFixed(0)} mm
            </span>
            <small>{result.dimensions.thicknessMm.toFixed(1)} mm total thickness</small>
          </>
        ) : (
          <span>{t(locale, 'dimensionsPending')}</span>
        )}
      </div>
      {feedback && (
        <div className="feedback" aria-live="polite">
          {feedback}
        </div>
      )}
    </div>
  </section>
);
