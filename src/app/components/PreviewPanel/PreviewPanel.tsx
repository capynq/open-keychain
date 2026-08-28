import { useEffect, useRef, useState } from 'react';
import { Viewer, type PreviewStatus, type SurfacePresetId } from '../../../features/preview';
import type { GeometryResult, PrintAppearanceOverrides } from '../../../domain/keychain';
import { applyPrintAppearanceOverrides } from '../../../domain/keychain';
import { t, type Locale } from '../../../infrastructure/i18n';
import { ResetIconButton } from '../../../components/ResetIconButton/ResetIconButton';
import styles from './PreviewPanel.module.css';

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
  exportOpen,
  modelInfo,
}: {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
    busy: boolean;
    error?: string;
  };
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: {
    templateId: string;
    template: string;
    style: string | undefined;
    font: string;
  };
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

export const PreviewPanel = ({
  locale,
  geometry,
  surfacePreset,
  status,
  exportOpen,
  modelInfo,
  onSurfaceChange,
  onSurfaceReset,
  appearanceOverrides,
  onAppearanceChange,
}: {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
    busy: boolean;
    error?: string;
    current?: boolean;
  };
  surfacePreset: SurfacePresetId;
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: {
    templateId: string;
    template: string;
    style: string | undefined;
    font: string;
  };
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onSurfaceReset: () => void;
  appearanceOverrides: PrintAppearanceOverrides;
  onAppearanceChange: (overrides: PrintAppearanceOverrides) => void;
}) => (
  <section
    className={`${styles.root} preview-panel`}
    data-guide-target="preview"
    aria-busy={geometry.busy}
    data-preview-state={
      geometry.error
        ? 'error'
        : geometry.current === false
          ? 'stale'
          : geometry.busy
            ? 'updating'
            : 'current'
    }
    data-generation-id={geometry.result?.generationId ?? ''}
    data-model-ready={
      geometry.result && geometry.result.baseMesh.positions.length > 0 ? 'true' : 'false'
    }
  >
    <div className="preview-heading">
      <h2 className="eyebrow">{t(locale, 'livePreview')}</h2>
      <span className={`status-pill ${status.className}`} role="status" aria-live="polite">
        {status.text}
      </span>
    </div>
    <div className="viewer-wrap" data-stale={geometry.current === false ? 'true' : 'false'}>
      <Viewer
        result={geometry.result}
        appearance={
          geometry.result
            ? applyPrintAppearanceOverrides(geometry.result.appearance, appearanceOverrides)
            : undefined
        }
        surfacePreset={surfacePreset}
        locale={locale}
      />
      <SurfacePopover
        locale={locale}
        surfacePreset={surfacePreset}
        onSurfaceChange={onSurfaceChange}
        onReset={onSurfaceReset}
      />
      {!geometry.error && (geometry.busy || geometry.current === false) && (
        <div className="viewer-loading" role="status" aria-live="polite">
          <span className="viewer-spinner" aria-hidden="true" />
          <span>{t(locale, geometry.busy ? 'updating' : 'previewStale')}</span>
        </div>
      )}
    </div>
    <PreviewSummary
      locale={locale}
      geometry={geometry}
      status={status}
      modelInfo={modelInfo}
      exportOpen={exportOpen}
    />
    <div className="appearance-controls" aria-label={t(locale, 'printColors')}>
      <div className="appearance-control">
        <span>{t(locale, 'baseColor')}</span>
        <input
          type="color"
          aria-label={t(locale, 'baseColor')}
          value={appearanceOverrides.base ?? geometry.result?.appearance.base.color ?? '#B84838'}
          onChange={(e) => onAppearanceChange({ ...appearanceOverrides, base: e.target.value })}
        />
        <ResetIconButton
          label={t(locale, 'resetBaseColor')}
          onClick={() => onAppearanceChange({ ...appearanceOverrides, base: undefined })}
        />
      </div>
      <div className="appearance-control">
        <span>{t(locale, 'secondaryColor')}</span>
        <input
          type="color"
          aria-label={t(locale, 'secondaryColor')}
          value={
            appearanceOverrides.relief ?? geometry.result?.appearance.relief.color ?? '#FAF4E9'
          }
          onChange={(e) => onAppearanceChange({ ...appearanceOverrides, relief: e.target.value })}
        />
        <ResetIconButton
          label={t(locale, 'resetSecondaryColor')}
          onClick={() => onAppearanceChange({ ...appearanceOverrides, relief: undefined })}
        />
      </div>
      <div className="appearance-reset-all">
        <ResetIconButton
          label={t(locale, 'resetColors')}
          onClick={() => onAppearanceChange({ version: 1 })}
        />
      </div>
    </div>
  </section>
);
