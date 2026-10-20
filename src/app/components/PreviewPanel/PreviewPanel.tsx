import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { recoveryMessage, recoverySteps } from '@/infrastructure/i18n/utils';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import type {
  GeometryResult,
  PrintAppearanceOverrides,
  SizeEnvelope,
} from '../../../domain/keychain/model/types';
import type {
  SurfacePresetId,
  Viewer as ViewerComponentExport,
} from '../../../features/preview/components/Viewer/Viewer';
import type { PhotoCaptureApi } from '../../../features/preview/model/photo-capture';
import type { PhotoDesign } from '../../../features/preview/model/photo-filename';
import type { PreviewStatus } from '../../../features/preview/model/preview-status';
import type {
  PreviewRenderState,
  ViewerRenderTimings,
} from '../../../features/preview/model/render-state';
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
    failure?: RecoveryFailure;
    retry?: () => void;
    current?: boolean;
  };
  surfacePreset: SurfacePresetId;
  status: PreviewStatus;
  exportOpen: boolean;
  modelInfo: PreviewModelInfo;
  photoDesign?: PhotoDesign;
  appearanceOverrides?: PrintAppearanceOverrides;
  onReviewIssue?: () => void;
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
  photoDesign,
  appearanceOverrides = { version: 1 },
  onSurfaceChange,
  onReviewIssue,
  onSurfaceReset,
}: PreviewPanelProps) => {
  const previewRef = useRef<HTMLElement>(null);
  const [viewerRetry, setViewerRetry] = useState(0);
  const autoRestartUsed = useRef(false);
  const latestSession = useRef(0);
  const [renderState, setRenderState] = useState<PreviewRenderState>({
    status: 'initializing',
    sessionId: 0,
  });
  const [importRetry, setImportRetry] = useState(0);
  const [photoCapture, setPhotoCapture] = useState<PhotoCaptureApi>();
  const [Viewer, setViewer] = useState<ViewerComponent | undefined>(undefined);
  const [viewerUnavailable, setViewerUnavailable] = useState(false);
  const [mountedAt] = useState(() => performance.now());
  const [viewerImportMs, setViewerImportMs] = useState<number>();
  const [firstDrawMs, setFirstDrawMs] = useState<number>();
  const renderedGenerationId =
    renderState.status === 'ready' ? renderState.generationId : undefined;
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
  }, [importRetry]);

  const onViewerStateChange = useCallback(
    (next: PreviewRenderState): void => {
      if (next.sessionId < latestSession.current) return;
      latestSession.current = next.sessionId;
      setRenderState(next);
      if (next.status === 'ready') {
        setViewerUnavailable(false);
        setRenderTimings(
          next.timings ? { generationId: next.generationId, ...next.timings } : undefined,
        );
        setFirstDrawMs((previous) => previous ?? performance.now() - mountedAt);
      } else {
        setRenderTimings(undefined);
        if (next.status === 'failed') {
          setPhotoCapture(undefined);
          if (!autoRestartUsed.current) {
            autoRestartUsed.current = true;
            setRenderState({ status: 'recovering', sessionId: next.sessionId });
            setViewerUnavailable(false);
            setViewerRetry((value) => value + 1);
          } else setViewerUnavailable(true);
        }
      }
    },
    [mountedAt],
  );
  const retryViewer = (): void => {
    autoRestartUsed.current = false;
    setViewerUnavailable(false);
    setPhotoCapture(undefined);
    setRenderState({ status: 'recovering', sessionId: latestSession.current });
    setViewerRetry((value) => value + 1);
  };
  const pendingPreview =
    !geometry.error &&
    !viewerUnavailable &&
    (geometry.busy ||
      geometry.current === false ||
      !Viewer ||
      renderState.status !== 'ready' ||
      (geometry.result !== undefined && renderedGenerationId !== geometry.result.generationId));
  const currentRenderTimings =
    renderTimings?.generationId === geometry.result?.generationId ? renderTimings : undefined;
  const viewerLoadFailed = viewerUnavailable && !Viewer;
  const candidateInputAt = geometry.result?.timings?.candidateInputAt;

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    if (!currentRenderTimings || candidateInputAt === undefined) {
      delete preview.dataset.previewReadyCommittedAt;
      delete preview.dataset.candidateToReadyMs;
      return;
    }
    // Draw submission precedes the React ready-state commit; measure both without another render.
    const committedAt = performance.now();

    preview.dataset.previewReadyCommittedAt = String(committedAt);
    preview.dataset.candidateToReadyMs = String(committedAt - candidateInputAt);
  }, [candidateInputAt, currentRenderTimings]);

  return (
    <section
      ref={previewRef}
      className={`${styles.root} preview-panel`}
      data-guide-target="preview"
      aria-busy={geometry.busy || pendingPreview}
      data-preview-state={
        geometry.error || viewerUnavailable
          ? 'error'
          : geometry.current === false
            ? 'stale'
            : geometry.busy || pendingPreview
              ? 'updating'
              : 'current'
      }
      data-generation-id={geometry.result?.generationId ?? ''}
      data-rendered-generation-id={renderedGenerationId ?? ''}
      data-renderer-session={renderState.sessionId}
      data-renderer-state={renderState.status}
      data-candidate-input-at={geometry.result?.timings?.candidateInputAt ?? ''}
      data-candidate-dispatched-at={geometry.result?.timings?.candidateDispatchedAt ?? ''}
      data-candidate-validated-at={geometry.result?.timings?.candidateValidatedAt ?? ''}
      data-candidate-accepted-at={geometry.result?.timings?.candidateAcceptedAt ?? ''}
      data-preview-rendered-at={currentRenderTimings?.renderedAt ?? ''}
      data-candidate-to-render-ms={
        currentRenderTimings && geometry.result?.timings?.candidateInputAt !== undefined
          ? currentRenderTimings.renderedAt - geometry.result.timings.candidateInputAt
          : ''
      }
      data-geometry-client-cache-hit={geometry.result?.timings?.clientCacheHit ?? 0}
      data-geometry-worker-cache-hit={geometry.result?.timings?.workerCacheHit ?? 0}
      data-geometry-client-cache-lookup-ms={geometry.result?.timings?.clientCacheLookupMs ?? ''}
      data-geometry-worker-compute-ms={geometry.result?.timings?.workerComputeMs ?? ''}
      data-geometry-cache-lookup-ms={geometry.result?.timings?.workerCacheLookupMs ?? ''}
      data-geometry-wasm-wait-ms={geometry.result?.timings?.wasmWaitMs ?? ''}
      data-geometry-response-preparation-ms={
        geometry.result?.timings?.workerResponsePreparationMs ?? ''
      }
      data-geometry-client-clone-ms={geometry.result?.timings?.clientCacheCloneMs ?? ''}
      data-geometry-client-queue-ms={geometry.result?.timings?.clientQueueMs ?? ''}
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
        <span
          className={`status-pill ${viewerUnavailable ? 'attention' : pendingPreview ? 'updating' : status.className}`}
          role="status"
          aria-live="polite"
        >
          {viewerUnavailable
            ? t(locale, 'previewUnavailableTitle')
            : pendingPreview
              ? t(locale, 'preparingPreview')
              : status.text}
        </span>
      </div>
      <div
        className="viewer-wrap"
        data-stale={geometry.current === false ? 'true' : 'false'}
        data-preview-unavailable={viewerUnavailable ? 'true' : undefined}
      >
        {Viewer ? (
          <Viewer
            result={geometry.result}
            restartKey={viewerRetry}
            onRetry={retryViewer}
            templateId={modelInfo.templateId}
            appearance={
              geometry.result
                ? applyPrintAppearanceOverrides(geometry.result.appearance, appearanceOverrides)
                : undefined
            }
            surfacePreset={surfacePreset}
            locale={locale}
            onStateChange={onViewerStateChange}
            onPhotoCaptureChange={setPhotoCapture}
            toolbarAction={
              <PreviewPhoto
                locale={locale}
                captureApi={photoCapture}
                design={photoDesign}
                disabled={
                  pendingPreview || viewerUnavailable || !!geometry.error || !geometry.result
                }
              />
            }
          />
        ) : viewerLoadFailed ? (
          <div className="viewer viewer--unavailable">
            <div className="viewer-unavailable">
              <span className="viewer-unavailable-icon" aria-hidden="true">
                !
              </span>
              <RecoveryNotice
                role="alert"
                message={recoveryMessage(locale, { code: 'preview-unavailable' })}
                steps={recoverySteps(locale, { code: 'preview-unavailable' })}
                detailsLabel={t(locale, 'recoveryDetails')}
                actions={[
                  {
                    id: 'retry-preview',
                    label: t(locale, 'recoveryRetry'),
                    onAction: () => {
                      setViewerUnavailable(false);
                      setImportRetry((value) => value + 1);
                    },
                  },
                  {
                    id: 'reload',
                    label: t(locale, 'recoveryReload'),
                    onAction: () => window.location.reload(),
                  },
                ]}
              />
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
        exportOpen={exportOpen}
        onReview={onReviewIssue}
      />
    </section>
  );
};
