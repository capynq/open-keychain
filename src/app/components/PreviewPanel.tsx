import { useEffect, useRef, useState } from 'react';
import { Viewer, type PreviewStatus, type SurfacePresetId } from '../../features/preview';
import type { GeometryResult } from '../../domain/keychain';
import { t, type Locale } from '../../infrastructure/i18n';
import { ResetIconButton } from '../../components/ResetIconButton';

const SURFACE_PRESETS: SurfacePresetId[] = ['matte', 'graph', 'dark', 'wood', 'metal'];

const SurfacePopover = ({
  locale,
  surfacePreset,
  onSurfaceChange,
  onReset,
}: {
  locale: Locale;
  surfacePreset: SurfacePresetId;
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onReset: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <div className="surface-popover" ref={popoverRef}>
      <button
        type="button"
        className="surface-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="surface-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`surface-dot surface-dot-${surfacePreset}`} aria-hidden="true" />
        <span>{t(locale, surfacePreset)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 9 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="surface-menu"
          id="surface-menu"
          role="dialog"
          aria-label={t(locale, 'surface')}
        >
          <div className="surface-menu-heading">
            <span>{t(locale, 'surface')}</span>
            <ResetIconButton
              label={t(locale, 'resetSurface')}
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            />
          </div>
          <div className="surface-options">
            {SURFACE_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={surfacePreset === preset ? 'selected' : ''}
                aria-pressed={surfacePreset === preset}
                onClick={() => {
                  onSurfaceChange(preset);
                  setOpen(false);
                }}
              >
                <span className={`surface-dot surface-dot-${preset}`} aria-hidden="true" />
                <span>{t(locale, preset)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PreviewSummary = ({
  locale,
  geometry,
  status,
  modelInfo,
}: {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
  };
  status: PreviewStatus;
  modelInfo: {
    template: string;
    style: string | undefined;
    font: string;
  };
}) => {
  const result = geometry.result;
  const dimensions = result?.dimensions;

  return (
    <section className="preview-summary" aria-label={t(locale, 'modelSummary')}>
      <div className="summary-heading">
        <span className="eyebrow">{t(locale, 'modelSummary')}</span>
      </div>
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
      {status.feedback && (
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

export const PreviewPanel = ({
  locale,
  geometry,
  surfacePreset,
  status,
  modelInfo,
  onSurfaceChange,
  onSurfaceReset,
}: {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
    busy: boolean;
  };
  surfacePreset: SurfacePresetId;
  status: PreviewStatus;
  modelInfo: {
    template: string;
    style: string | undefined;
    font: string;
  };
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onSurfaceReset: () => void;
}) => (
  <section
    className="preview-panel"
    data-guide-target="preview"
    aria-busy={geometry.busy}
    data-generation-id={geometry.result?.generationId ?? ''}
  >
    <div className="preview-heading">
      <h2 className="eyebrow">{t(locale, 'livePreview')}</h2>
      <span className={`status-pill ${status.className}`} role="status" aria-live="polite">
        {status.text}
      </span>
    </div>
    <div className="viewer-wrap">
      <Viewer result={geometry.result} surfacePreset={surfacePreset} locale={locale} />
      <SurfacePopover
        locale={locale}
        surfacePreset={surfacePreset}
        onSurfaceChange={onSurfaceChange}
        onReset={onSurfaceReset}
      />
      {geometry.busy && (
        <div className="viewer-loading" role="status" aria-live="polite">
          <span className="viewer-spinner" aria-hidden="true" />
          <span>{t(locale, 'updating')}</span>
        </div>
      )}
    </div>
    <PreviewSummary locale={locale} geometry={geometry} status={status} modelInfo={modelInfo} />
  </section>
);
