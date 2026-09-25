import { useCallback, useEffect, useState } from 'react';

import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import type {
  GeometryResult,
  PrintAppearanceOverrides,
} from '../../../domain/keychain/model/types';
import type {
  SurfacePresetId,
  ViewerRenderTimings,
  Viewer as ViewerComponentExport,
} from '../../../features/preview/components/Viewer/Viewer';
import type { PreviewStatus } from '../../../features/preview/model/preview-status';
import type { Locale } from '../../../infrastructure/i18n/config';

import { applyPrintAppearanceOverrides } from '../../../domain/keychain/model/types';
import { t } from '../../../infrastructure/i18n/utils';
import styles from './PreviewPanel.module.css';
import { PreviewSummary, type PreviewModelInfo } from './PreviewSummary';
import { SurfacePopover } from './SurfacePopover';

type ViewerComponent = typeof ViewerComponentExport;

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
  neutralSummary?: boolean;
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
  neutralSummary = false,
}: PreviewPanelProps) => {
  const [Viewer, setViewer] = useState<ViewerComponent | undefined>(undefined);
  const [viewerUnavailable, setViewerUnavailable] = useState(false);
  const [renderedGenerationId, setRenderedGenerationId] = useState<number>();
  const [renderTimings, setRenderTimings] = useState<
    (ViewerRenderTimings & { generationId: number }) | undefined
  >();

  useEffect(() => {
    let active = true;

    import('../../../features/preview/components/Viewer/Viewer')
      .then(({ Viewer: loadedViewer }) => {
        if (active) setViewer(() => loadedViewer);
      })
      .catch(() => {
        if (active) setViewerUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const onViewerRendered = useCallback(
    (generationId: number, timings?: ViewerRenderTimings): void => {
      setRenderedGenerationId(generationId);
      setRenderTimings(timings ? { generationId, ...timings } : undefined);
    },
    [],
  );
  const onViewerUnavailable = useCallback((): void => {
    setViewerUnavailable(true);
  }, []);
  const pendingPreview =
    !geometry.error &&
    !viewerUnavailable &&
    (geometry.busy ||
      geometry.current === false ||
      !Viewer ||
      (geometry.result !== undefined && renderedGenerationId !== geometry.result.generationId));
  const currentRenderTimings =
    renderTimings?.generationId === geometry.result?.generationId ? renderTimings : undefined;
  const viewerLoadFailed = viewerUnavailable && !Viewer;

  return (
    <section
      className={`${styles.root} preview-panel`}
      data-guide-target="preview"
      aria-busy={geometry.busy || pendingPreview}
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
      data-rendered-generation-id={renderedGenerationId ?? ''}
      data-geometry-worker-compute-ms={geometry.result?.timings?.workerComputeMs ?? ''}
      data-geometry-cache-lookup-ms={geometry.result?.timings?.workerCacheLookupMs ?? ''}
      data-viewer-mesh-setup-ms={currentRenderTimings?.meshSetupMs ?? ''}
      data-viewer-draw-submit-ms={currentRenderTimings?.drawSubmitMs ?? ''}
      data-model-ready={
        geometry.result && geometry.result.baseMesh.positions.length > 0 ? 'true' : 'false'
      }
    >
      <div className="preview-heading">
        <h2 className="preview-title">{t(locale, 'livePreview')}</h2>
        <span className={`status-pill ${status.className}`} role="status" aria-live="polite">
          {status.text}
        </span>
      </div>
      <div className="viewer-wrap" data-stale={geometry.current === false ? 'true' : 'false'}>
        {Viewer ? (
          <Viewer
            result={geometry.result}
            appearance={
              geometry.result
                ? applyPrintAppearanceOverrides(geometry.result.appearance, appearanceOverrides)
                : undefined
            }
            surfacePreset={surfacePreset}
            locale={locale}
            onRendered={onViewerRendered}
            onUnavailable={onViewerUnavailable}
          />
        ) : viewerLoadFailed ? (
          <div className="viewer viewer--unavailable">
            <div className="viewer-unavailable" role="status">
              <span className="viewer-unavailable-icon" aria-hidden="true">
                !
              </span>
              <strong>{t(locale, 'previewUnavailableTitle')}</strong>
              <p>{t(locale, 'previewUnavailable')}</p>
            </div>
          </div>
        ) : (
          <div className="viewer viewer--preparing" aria-hidden="true" />
        )}
        <SurfacePopover
          locale={locale}
          surfacePreset={surfacePreset}
          onSurfaceChange={onSurfaceChange}
          onReset={onSurfaceReset}
        />
        {pendingPreview && (
          <div className="viewer-loading" role="status" aria-live="polite">
            <span className="viewer-spinner" aria-hidden="true" />
            <span>
              {geometry.result === undefined
                ? t(locale, 'preparingPreview')
                : geometry.busy
                  ? t(locale, 'updating')
                  : geometry.current === false
                    ? t(locale, 'previewStale')
                    : t(locale, 'preparingPreview')}
            </span>
          </div>
        )}
      </div>
      <PreviewSummary
        locale={locale}
        geometry={geometry}
        status={status}
        modelInfo={modelInfo}
        exportOpen={exportOpen}
        neutral={neutralSummary}
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
};
