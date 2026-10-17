import { Camera } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

import { IconButton } from '@/shared/ui/IconButton';

import type {
  GeometryResult,
  PrintAppearanceOverrides,
  SizeEnvelope,
} from '../../../domain/keychain/model/types';
import type {
  SurfacePresetId,
  ViewerRenderTimings,
  Viewer as ViewerComponentExport,
} from '../../../features/preview/components/Viewer/Viewer';
import type { PhotoCaptureApi } from '../../../features/preview/model/photo-capture';
import type { PreviewStatus } from '../../../features/preview/model/preview-status';
import type { Locale } from '../../../infrastructure/i18n/config';

import { applyPrintAppearanceOverrides } from '../../../domain/keychain/model/types';
import { t } from '../../../infrastructure/i18n/utils';
import styles from './PreviewPanel.module.css';
import { PreviewPhoto } from './PreviewPhoto';
import { PreviewSummary } from './PreviewSummary';
import { SurfacePopover } from './SurfacePopover';

type ViewerComponent = typeof ViewerComponentExport;
type PreviewModelInfo = { templateId: string };

export type PreviewPanelProps = {
  locale: Locale;
  geometry: {
    result: GeometryResult | undefined;
    sizeEnvelope?: SizeEnvelope;
    busy: boolean;
    error?: string;
    current?: boolean;
  };
  surfacePreset: SurfacePresetId;
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: PreviewModelInfo;
  appearanceOverrides?: PrintAppearanceOverrides;
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onSurfaceReset: () => void;
};

export const PreviewPanel = ({
  locale,
  geometry,
  surfacePreset,
  status,
  exportOpen,
  modelInfo,
  appearanceOverrides = { version: 1 },
  onSurfaceChange,
  onSurfaceReset,
}: PreviewPanelProps) => {
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoChoicesId = useId();
  const [photoCapture, setPhotoCapture] = useState<PhotoCaptureApi>();
  const [Viewer, setViewer] = useState<ViewerComponent | undefined>(undefined);
  const [viewerUnavailable, setViewerUnavailable] = useState(false);
  const [mountedAt] = useState(() => performance.now());
  const [viewerImportMs, setViewerImportMs] = useState<number>();
  const [firstDrawMs, setFirstDrawMs] = useState<number>();
  const [renderedGenerationId, setRenderedGenerationId] = useState<number>();
  const [renderTimings, setRenderTimings] = useState<
    (ViewerRenderTimings & { generationId: number }) | undefined
  >();

  useEffect(() => {
    let active = true;
    const importStartedAt = performance.now();

    import('../../../features/preview/components/Viewer/Viewer')
      .then(({ Viewer: loadedViewer }) => {
        if (active) {
          setViewerImportMs(performance.now() - importStartedAt);
          setViewer(() => loadedViewer);
        }
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
      setFirstDrawMs((previous) => previous ?? performance.now() - mountedAt);
    },
    [mountedAt],
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
      data-geometry-wasm-wait-ms={geometry.result?.timings?.wasmWaitMs ?? ''}
      data-geometry-response-preparation-ms={
        geometry.result?.timings?.workerResponsePreparationMs ?? ''
      }
      data-geometry-client-clone-ms={geometry.result?.timings?.clientCacheCloneMs ?? ''}
      data-geometry-client-round-trip-ms={geometry.result?.timings?.clientRoundTripMs ?? ''}
      data-viewer-import-ms={viewerImportMs ?? ''}
      data-viewer-initialization-ms={currentRenderTimings?.initializationMs ?? ''}
      data-preview-first-draw-ms={firstDrawMs ?? ''}
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
            templateId={modelInfo.templateId}
            appearance={
              geometry.result
                ? applyPrintAppearanceOverrides(geometry.result.appearance, appearanceOverrides)
                : undefined
            }
            surfacePreset={surfacePreset}
            locale={locale}
            onRendered={onViewerRendered}
            onUnavailable={onViewerUnavailable}
            onPhotoCaptureChange={setPhotoCapture}
            toolbarAction={
              <IconButton
                action="preview-photo"
                className={photoOpen ? 'active' : undefined}
                icon={Camera}
                label={t(locale, 'photoButton')}
                motion="none"
                aria-expanded={photoOpen}
                aria-controls={photoChoicesId}
                disabled={
                  !photoCapture ||
                  pendingPreview ||
                  viewerUnavailable ||
                  !!geometry.error ||
                  !geometry.result
                }
                onClick={() => setPhotoOpen((previous) => !previous)}
              />
            }
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
      <PreviewPhoto
        open={photoOpen}
        choicesId={photoChoicesId}
        locale={locale}
        captureApi={photoCapture}
        disabled={pendingPreview || viewerUnavailable || !!geometry.error || !geometry.result}
      />
      <PreviewSummary locale={locale} geometry={geometry} status={status} exportOpen={exportOpen} />
    </section>
  );
};
