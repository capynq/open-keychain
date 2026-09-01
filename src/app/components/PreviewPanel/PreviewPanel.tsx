import { Viewer, type PreviewStatus, type SurfacePresetId } from '../../../features/preview';
import type { GeometryResult, PrintAppearanceOverrides } from '../../../domain/keychain';
import { applyPrintAppearanceOverrides } from '../../../domain/keychain';
import { t, type Locale } from '../../../infrastructure/i18n';
import { ResetIconButton } from '../../../components/ResetIconButton/ResetIconButton';
import { PreviewSummary, type PreviewModelInfo } from './PreviewSummary';
import { SurfacePopover } from './SurfacePopover';
import styles from './PreviewPanel.module.css';

export type PreviewPanelProps = {
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
  modelInfo: PreviewModelInfo;
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onSurfaceReset: () => void;
  appearanceOverrides: PrintAppearanceOverrides;
  onAppearanceChange: (overrides: PrintAppearanceOverrides) => void;
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
}: PreviewPanelProps) => (
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
          onChange={(event) =>
            onAppearanceChange({ ...appearanceOverrides, base: event.target.value })
          }
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
          onChange={(event) =>
            onAppearanceChange({ ...appearanceOverrides, relief: event.target.value })
          }
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
