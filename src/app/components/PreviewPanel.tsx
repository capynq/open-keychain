import { useEffect, useRef, useState } from 'react';
import { Viewer, type PreviewStatus, type SurfacePresetId } from '../../features/preview';
import type { GeometryResult, PrintAppearanceOverrides } from '../../domain/keychain';
import { applyPrintAppearanceOverrides } from '../../domain/keychain';
import { t, type Locale } from '../../infrastructure/i18n';
import { ResetIconButton } from '../../components/ResetIconButton';
import { buildPreflightReport } from '../../features/export';
import { issueMessage } from '../../infrastructure/i18n';
import { InfoBlock } from '../../features/customizer/components/InfoBlock';

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
  const report = buildPreflightReport(result, undefined, geometry.busy, geometry.error);

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
      <details className="print-confidence">
        <summary>
          <span>{t(locale, 'printConfidence')}</span>
          <strong>
            {report.status === 'generating'
              ? t(locale, 'printCheckPending')
              : report.status === 'blocked'
                ? t(locale, 'printCheckBlocked')
                : report.status === 'ready-with-warnings'
                  ? t(locale, 'printCheckWarnings')
                  : t(locale, 'printProfileReady')}
          </strong>
        </summary>
        <div className="print-confidence-body">
          {modelInfo.templateId === 'magnet' && (
            <InfoBlock tone="hardware" title={t(locale, 'magnetHardwareTitle')}>
              <>
                {t(locale, 'magnetHardware')}
                {result?.magnetPocket && (
                  <small>
                    {t(locale, 'magnetPocketDetails', {
                      diameter: result.magnetPocket.diameterMm.toFixed(1),
                      depth: result.magnetPocket.depthMm.toFixed(1),
                    })}
                  </small>
                )}
              </>
            </InfoBlock>
          )}
          {report.profile && (
            <>
              <span>{t(locale, 'printProfile')}</span>
              <span>{report.profile.id}</span>
              <span>
                {report.profile.nozzleDiameterMm.toFixed(1)} mm ·{' '}
                {report.profile.supports ? t(locale, 'supportsRequired') : t(locale, 'noSupports')}{' '}
                ·{' '}
                {report.profile.recommendedOrientation === 'flat'
                  ? t(locale, 'flatOrientation')
                  : t(locale, 'customOrientation')}
              </span>
            </>
          )}
          {report.issues.length > 0 && (
            <ul className="print-check-issues">
              {report.issues
                .filter((issue) => issueMessage(locale, issue) !== status.feedback)
                .map((issue) => (
                  <li key={`${issue.code}-${issue.message}`} className={issue.severity}>
                    {issueMessage(locale, issue)}
                  </li>
                ))}
            </ul>
          )}
          <p>{t(locale, 'printProfileNotice')}</p>
        </div>
      </details>
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
    className="preview-panel"
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
        <button
          type="button"
          aria-label={t(locale, 'resetBaseColor')}
          onClick={() => onAppearanceChange({ ...appearanceOverrides, base: undefined })}
        >
          {t(locale, 'resetBaseColor')}
        </button>
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
        <button
          type="button"
          aria-label={t(locale, 'resetSecondaryColor')}
          onClick={() => onAppearanceChange({ ...appearanceOverrides, relief: undefined })}
        >
          {t(locale, 'resetSecondaryColor')}
        </button>
      </div>
      <button type="button" onClick={() => onAppearanceChange({ version: 1 })}>
        {t(locale, 'resetColors')}
      </button>
    </div>
  </section>
);
