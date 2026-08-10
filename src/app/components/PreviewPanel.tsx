import { Viewer, type PreviewStatus, type SurfacePresetId } from '../../features/preview';
import type { GeometryResult } from '../../domain/keychain';
import { t, type Locale } from '../../infrastructure/i18n';

export const PreviewPanel = ({
  locale,
  text,
  geometry,
  surfacePreset,
  status,
}: {
  locale: Locale;
  text: string;
  geometry: {
    result: GeometryResult | undefined;
    busy: boolean;
  };
  surfacePreset: SurfacePresetId;
  status: PreviewStatus;
}) => (
  <section className="preview-panel">
    <div className="preview-heading">
      <div>
        <p className="eyebrow">{t(locale, 'livePreview')}</p>
        <h2>{text || t(locale, 'title')}</h2>
      </div>
      <span className={`status-pill ${status.className}`}>{status.text}</span>
    </div>
    <div className="viewer-wrap">
      <Viewer result={geometry.result} surfacePreset={surfacePreset} locale={locale} />
      {geometry.busy && <div className="viewer-loading">{t(locale, 'updating')}</div>}
    </div>
    <div className="preview-footer">
      <div className="dimensions">
        {geometry.result && geometry.result.dimensions.widthMm > 0 ? (
          <>
            <span>
              {geometry.result.dimensions.widthMm.toFixed(0)} ×{' '}
              {geometry.result.dimensions.heightMm.toFixed(0)} mm
            </span>
            <small>{geometry.result.dimensions.thicknessMm.toFixed(1)} mm total thickness</small>
          </>
        ) : (
          <span>{t(locale, 'dimensionsPending')}</span>
        )}
      </div>
      {status.feedback && (
        <div className="feedback" aria-live="polite">
          {status.feedback}
        </div>
      )}
    </div>
  </section>
);
