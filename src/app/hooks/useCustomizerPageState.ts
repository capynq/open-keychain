import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from 'react';

import type { CandidateCallbacks } from '../../features/customizer/hooks/useCustomizerParams';
import type { SurfacePresetId } from '../../features/preview/components/Viewer/Viewer';
import type { Locale } from '../../infrastructure/i18n/config';

import {
  DEFAULT_PARAMS,
  normalizeParams,
  type KeychainParams,
  type PrintAppearanceOverrides,
} from '../../domain/keychain/model/types';
import { STYLE_CATALOG } from '../../domain/keychain/styles/style-builder';
import { useCustomizerParams } from '../../features/customizer/hooks/useCustomizerParams';
import {
  geometryInputKey,
  type GeometryAttemptCallbacks,
  useGeometryGeneration,
} from '../../features/customizer/hooks/useGeometryGeneration';
import { useExportActions } from '../../features/export/model/use-export-actions';
import { useHostedAccount } from '../../features/hosted/hooks/useHostedAccount';
import { previewStatus } from '../../features/preview/model/preview-status';
import { useShareDesign } from '../../features/share/useShareDesign';
import { GeometryClient } from '../../infrastructure/geometry/geometry-client';
import { styleName, templateName } from '../../infrastructure/i18n/utils';
import { useAnalytics } from '../../infrastructure/telemetry/useTelemetry';

export const useCustomizerPageState = (
  locale: Locale,
  initialParams?: KeychainParams,
  initialAppearanceOverrides?: PrintAppearanceOverrides,
  routeInputKey?: string,
) => {
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>('matte');
  const [exportOpen, setExportOpen] = useState(false);
  const [disconnectedAcknowledgedSignature, setDisconnectedAcknowledgedSignature] = useState<
    string | undefined
  >(undefined);
  const [appearanceOverrides, setAppearanceOverrides] = useReducer(
    (current: PrintAppearanceOverrides, next: SetStateAction<PrintAppearanceOverrides>) =>
      typeof next === 'function' ? next(current) : next,
    initialAppearanceOverrides ?? { version: 1 },
  );
  const [randomizing, setRandomizing] = useState(false);
  const [randomizeFailure, setRandomizeFailure] = useState(false);
  const { consent, track } = useAnalytics();
  const [skipRequestKey, setSkipRequestKey] = useState<string>();
  const geometryRef = useRef<ReturnType<typeof useGeometryGeneration> | undefined>(undefined);
  const recoveryClientRef = useRef<GeometryClient | undefined>(undefined);
  const geometryAttemptStartedAt = useRef(
    new Map<
      string,
      {
        startedAt: number;
        template: string;
        group: string;
        controlKey?: string;
        retryOfAttemptId?: string;
        recoveryTrigger?: 'user_retry' | 'user_edit';
        recoveryOutcome?: 'recovered' | 'not_needed' | 'failed';
      }
    >(),
  );

  useEffect(() => () => recoveryClientRef.current?.dispose(), []);
  const [candidateCallbacks] = useState<CandidateCallbacks>(() => ({
    attemptStarted: (attemptId, template, group, controlKey, retryOfAttemptId) => {
      geometryAttemptStartedAt.current.set(attemptId, {
        startedAt: performance.now(),
        template,
        group,
        controlKey,
        retryOfAttemptId,
        recoveryTrigger: retryOfAttemptId ? 'user_retry' : undefined,
        recoveryOutcome: retryOfAttemptId ? 'not_needed' : undefined,
      });
      track('geometry_attempt_started', {
        template,
        operation: 'validation',
        geometry_attempt_id: attemptId,
        control_group: group,
        control_key: controlKey,
        retry_of_attempt_id: retryOfAttemptId,
        recovery_trigger: retryOfAttemptId ? 'user_retry' : undefined,
      });
    },
    attemptFinished: (attemptId, outcome, failure, diagnostics, generationId) => {
      const attempt = geometryAttemptStartedAt.current.get(attemptId);

      geometryAttemptStartedAt.current.delete(attemptId);
      track('geometry_attempt_finished', {
        template: attempt?.template,
        operation: 'validation',
        geometry_attempt_id: attemptId,
        outcome:
          outcome === 'accepted'
            ? 'success'
            : outcome === 'rejected'
              ? 'rejected'
              : outcome === 'superseded' || outcome === 'cancelled'
                ? outcome
                : 'error',
        duration_ms:
          attempt === undefined ? undefined : Math.round(performance.now() - attempt.startedAt),
        failure_code: failure?.code,
        failure_stage: diagnostics?.stage ?? (failure ? 'generation' : undefined),
        error_type: outcome === 'failed' ? diagnostics?.type : undefined,
        control_group: attempt?.group,
        control_key: attempt?.controlKey,
        geometry_generation_id: generationId,
        retry_of_attempt_id: attempt?.retryOfAttemptId,
        recovery_trigger: attempt?.recoveryTrigger,
        recovery_outcome: attempt?.recoveryOutcome,
      });
    },
    pending: (params, font, subtitleFont) => {
      geometryRef.current?.clientRef.current?.cancelCandidate();
      setSkipRequestKey(geometryInputKey(params, font, subtitleFont));
    },
    validate: (params, font, subtitleFont, attemptId, userRetry) => {
      const client = geometryRef.current?.clientRef.current;
      if (!client) return Promise.reject(new Error('Geometry validation is not ready.'));
      const attempt = attemptId ? geometryAttemptStartedAt.current.get(attemptId) : undefined;
      try {
        const recovered = userRetry ? client.recoverForUserRetry() : client.recoverForUserEdit();
        if (attempt && userRetry) {
          attempt.recoveryTrigger = 'user_retry';
          attempt.recoveryOutcome = recovered ? 'recovered' : 'not_needed';
        } else if (attempt && recovered) {
          attempt.recoveryTrigger = 'user_edit';
          attempt.recoveryOutcome = 'recovered';
        }
        return client.validateCandidate(params, font, subtitleFont);
      } catch (error) {
        if (attempt) {
          attempt.recoveryTrigger = userRetry ? 'user_retry' : 'user_edit';
          attempt.recoveryOutcome = 'failed';
        }
        return Promise.reject(error);
      }
    },
    validateRecovery: async (params, font, subtitleFont) => {
      const client = geometryRef.current?.clientRef.current;
      if (!client) throw new Error('Geometry validation is not ready.');
      // Disposable background work must not queue ahead of interactive edits or export.
      recoveryClientRef.current ??= new GeometryClient();
      const result = await recoveryClientRef.current.validate(params, font, subtitleFont);

      return client.identifyValidatedResult(result);
    },
    cancelRecovery: () => {
      recoveryClientRef.current?.dispose();
      recoveryClientRef.current = undefined;
    },
    accept: (params, result, font, subtitleFont) => {
      geometryRef.current?.adoptResult(result, params, font, subtitleFont);
      setSkipRequestKey(undefined);
    },
    reject: (params, font, subtitleFont) => {
      geometryRef.current?.clientRef.current?.cancelCandidate();
      const currentGeometry = geometryRef.current;
      if (currentGeometry?.result)
        currentGeometry.adoptResult(currentGeometry.result, params, font, subtitleFont);
      setSkipRequestKey(undefined);
    },
  }));
  const [designId, setDesignId] = useState(() => crypto.randomUUID());
  const analyticsContextRef = useRef({ locale, track, designId });

  useLayoutEffect(() => {
    analyticsContextRef.current = { locale, track, designId };
  }, [designId, locale, track]);
  const lastOpenedDesignId = useRef<string | undefined>(undefined);
  const customizer = useCustomizerParams(initialParams, candidateCallbacks);
  const activeStyle = STYLE_CATALOG.find((style) => style.id === customizer.acceptedParams.styleId);
  const geometryInputSignature = JSON.stringify([
    customizer.acceptedParams,
    customizer.fontForId(customizer.acceptedParams.fontId).id,
    customizer.fontForId(customizer.acceptedParams.subtitleFontId).id,
  ]);
  const disconnectedExportAcknowledged =
    disconnectedAcknowledgedSignature === geometryInputSignature;
  const setDisconnectedExportAcknowledged = (acknowledged: boolean): void => {
    setDisconnectedAcknowledgedSignature(acknowledged ? geometryInputSignature : undefined);
  };
  const geometryAttemptCallbacks = useMemo<GeometryAttemptCallbacks>(
    () => ({
      started: (attemptId, params) => {
        geometryAttemptStartedAt.current.set(attemptId, {
          startedAt: performance.now(),
          template: params.templateId,
          group: 'preview',
        });
        analyticsContextRef.current.track('geometry_attempt_started', {
          template: params.templateId,
          operation: 'preview',
          geometry_attempt_id: attemptId,
        });
      },
      finished: (attemptId, outcome, details) => {
        const attempt = geometryAttemptStartedAt.current.get(attemptId);

        geometryAttemptStartedAt.current.delete(attemptId);
        analyticsContextRef.current.track('geometry_attempt_finished', {
          template: attempt?.template,
          operation: 'preview',
          geometry_attempt_id: attemptId,
          duration_ms:
            attempt === undefined ? undefined : Math.round(performance.now() - attempt.startedAt),
          outcome,
          failure_code: details?.failure?.code,
          failure_stage:
            details?.diagnostics?.stage ?? (details?.failure ? 'generation' : undefined),
          error_type: details?.diagnostics?.type,
          geometry_generation_id: details?.generationId,
        });
        if (outcome === 'success') {
          analyticsContextRef.current.track('geometry_ready', {
            template: attempt?.template,
            locale: analyticsContextRef.current.locale,
            design_id: analyticsContextRef.current.designId,
            geometry_attempt_id: attemptId,
            duration_ms:
              attempt === undefined ? undefined : Math.round(performance.now() - attempt.startedAt),
            geometry_generation_id: details?.generationId,
            outcome: 'success',
          });
        }
      },
    }),
    [],
  );
  const geometry = useGeometryGeneration(
    customizer.params,
    customizer.selectedFont,
    customizer.selectedSubtitleFont,
    skipRequestKey,
    geometryAttemptCallbacks,
  );
  const { resultParamsKey: geometryResultParamsKey } = geometry;
  const acceptedGeometryParamsKey = geometryInputKey(
    customizer.acceptedParams,
    customizer.fontForId(customizer.acceptedParams.fontId),
    customizer.fontForId(customizer.acceptedParams.subtitleFontId),
  );

  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);
  const share = useShareDesign({
    params: customizer.acceptedParams,
    appearanceOverrides,
    hasNonBundledFont:
      customizer.fontForId(customizer.acceptedParams.fontId).source !== 'bundled' ||
      customizer.fontForId(customizer.acceptedParams.subtitleFontId).source !== 'bundled',
  });
  const hosted = useHostedAccount(
    customizer.acceptedParams,
    (projectParams) => {
      customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...projectParams }));
    },
    locale,
  );
  const disconnectedOnly = Boolean(
    geometry.result &&
    geometry.result.issues.some((issue) => issue.severity === 'error') &&
    geometry.result.issues
      .filter((issue) => issue.severity === 'error')
      .every((issue) => issue.code === 'disconnected'),
  );
  const canExport =
    !randomizing &&
    customizer.candidateFeedback?.status !== 'checking' &&
    Boolean(
      geometry.result &&
      geometryResultParamsKey === acceptedGeometryParamsKey &&
      (geometry.result.printable || disconnectedOnly),
    );
  const exportState = useExportActions({
    geometry,
    params: customizer.acceptedParams,
    fontDefinition: customizer.fontForId(customizer.acceptedParams.fontId),
    subtitleFontDefinition: customizer.fontForId(customizer.acceptedParams.subtitleFontId),
    appearanceOverrides,
    exportAllowed: canExport,
    allowDisconnected: disconnectedExportAcknowledged,
    designId,
  });
  const openExport = (): void => {
    if (!canExport || exportOpen) return;
    track('export_dialog_opened', {
      template: customizer.acceptedParams.templateId,
      design_id: designId,
    });
    setExportOpen(true);
  };
  const lastRouteInputKey = useRef(routeInputKey);

  useEffect(() => {
    if (!randomizeFailure) return undefined;
    const timer = window.setTimeout(() => setRandomizeFailure(false), 4_000);

    return () => window.clearTimeout(timer);
  }, [randomizeFailure]);

  useEffect(() => {
    if (routeInputKey === lastRouteInputKey.current) return;
    lastRouteInputKey.current = routeInputKey;
    setDesignId(crypto.randomUUID());

    customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...initialParams }));
    setAppearanceOverrides(initialAppearanceOverrides ?? { version: 1 });
    setDisconnectedAcknowledgedSignature(undefined);
  }, [customizer, initialAppearanceOverrides, initialParams, routeInputKey]);

  const lastTemplate = useRef(customizer.acceptedParams.templateId);

  useEffect(() => {
    if (consent !== 'accepted' || lastOpenedDesignId.current === designId) return;
    lastOpenedDesignId.current = designId;
    track('customizer_opened', { design_id: designId });
  }, [consent, designId, track]);

  useEffect(() => {
    if (lastTemplate.current !== customizer.acceptedParams.templateId) {
      track('template_selected', { template: customizer.acceptedParams.templateId, locale });
      lastTemplate.current = customizer.acceptedParams.templateId;
    }
  }, [customizer.acceptedParams.templateId, locale, track]);

  const randomize = (): void => {
    if (randomizing) return;
    setRandomizing(true);
    setRandomizeFailure(false);
    void customizer
      .randomize(undefined, async (candidate) => {
        const client = geometry.clientRef.current;
        if (!client) return false;
        return client.validate(
          candidate,
          customizer.fontForId(candidate.fontId),
          customizer.fontForId(candidate.subtitleFontId),
        );
      })
      .then((transaction) => {
        if (transaction.status === 'cancelled') {
          setRandomizing(false);
          return;
        }
        if (transaction.status === 'accepted') {
          setRandomizing(false);
        } else {
          setRandomizeFailure(true);
          setRandomizing(false);
        }
      })
      .catch(() => {
        setRandomizeFailure(true);
        setRandomizing(false);
      });
  };

  const undo = (): void => {
    if (randomizing) return;
    customizer.undo();
  };

  return {
    customizer,
    geometry,
    hosted,
    exportState,
    surfacePreset,
    setSurfacePreset,
    exportOpen,
    setExportOpen,
    disconnectedExportAcknowledged,
    setDisconnectedExportAcknowledged,
    canExport,
    openExport,
    appearanceOverrides,
    setAppearanceOverrides,
    share,
    randomizing,
    randomizeFailure,
    randomize,
    undo,
    status: previewStatus(geometry, locale),
    modelInfo: {
      templateId: customizer.acceptedParams.templateId,
      template: templateName(
        locale,
        customizer.acceptedParams.templateId,
        customizer.activeTemplate.name,
      ),
      style: activeStyle ? styleName(locale, activeStyle.id, activeStyle.name) : undefined,
      font: customizer.fontForId(customizer.acceptedParams.fontId).name,
    },
  };
};

export type CustomizerPageState = ReturnType<typeof useCustomizerPageState>;
