import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';
import type { OperationDiagnostics } from '@/shared/lib/recovery/operation-diagnostics';

import { failureFrom } from '@/shared/lib/recovery/failure';

import type { FontDefinition } from '../../../domain/keychain/fonts/catalog';
import type { GeometryResult, KeychainParams } from '../../../domain/keychain/model/types';

import {
  GeometryClient,
  GeometryCandidateSupersededError,
} from '../../../infrastructure/geometry/geometry-client';
import { takePrewarmedGeometryClient } from '../../../infrastructure/geometry/geometry-client-pool';
import { logError } from '../../../shared/lib/support/error-log';
import { attributeAdoptedBoot, type GeometryBootAttribution } from '../model/geometry-telemetry';

export type GeometryAttemptCallbacks = {
  started: (
    attemptId: string,
    params: KeychainParams,
    recoveryTrigger?: 'auto_replacement',
  ) => void;
  finished: (
    attemptId: string,
    outcome: 'success' | 'error' | 'superseded' | 'cancelled',
    details?: {
      failure?: RecoveryFailure;
      diagnostics?: OperationDiagnostics;
      generationId?: number;
      timings?: Record<string, number>;
      boot?: GeometryBootAttribution;
      workerReplacements?: number;
    },
  ) => void;
};

const AUTO_REQUEST_FAILURE_CODES = new Set([
  'geometry-worker-boot-timeout',
  'geometry-worker-failed',
]);

export const geometryInputKey = (
  params: KeychainParams,
  fontDefinition?: FontDefinition,
  subtitleFontDefinition?: FontDefinition,
): string =>
  JSON.stringify({
    params,
    font: fontDefinition
      ? {
          id: fontDefinition.id,
          source: fontDefinition.source,
          revision: fontDefinition.dataRevision ?? fontDefinition.data?.byteLength,
        }
      : undefined,
    subtitleFont: subtitleFontDefinition
      ? {
          id: subtitleFontDefinition.id,
          source: subtitleFontDefinition.source,
          revision: subtitleFontDefinition.dataRevision ?? subtitleFontDefinition.data?.byteLength,
        }
      : undefined,
  });

export const useGeometryGeneration = (
  params: KeychainParams,
  fontDefinition?: FontDefinition,
  subtitleFontDefinition?: FontDefinition,
  skipRequestKey?: string,
  attemptCallbacks?: GeometryAttemptCallbacks,
): {
  clientRef: MutableRefObject<GeometryClient | undefined>;
  result: GeometryResult | undefined;
  busy: boolean;
  error: string | undefined;
  failure: RecoveryFailure | undefined;
  diagnostics: OperationDiagnostics | undefined;
  retry: () => void;
  current: boolean;
  paramsKey: string;
  resultParamsKey: string | undefined;
  adoptResult: (
    result: GeometryResult,
    forParams?: KeychainParams,
    forFont?: FontDefinition,
    forSubtitleFont?: FontDefinition,
  ) => void;
  setError: Dispatch<SetStateAction<string | undefined>>;
} => {
  const clientRef = useRef<GeometryClient | undefined>(undefined);
  const resultRef = useRef<GeometryResult | undefined>(undefined);
  const [result, setResult] = useState<GeometryResult>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<RecoveryFailure>();
  const [diagnostics, setDiagnostics] = useState<OperationDiagnostics>();
  const [retryId, setRetryId] = useState(0);
  const paramsKey = geometryInputKey(params, fontDefinition, subtitleFontDefinition);
  const isDisposingRef = useRef(false);
  const [resultParamsKey, setResultParamsKey] = useState<string>();
  const adoptedKeyRef = useRef<string | undefined>(undefined);
  const reportedBootRef = useRef<{ client: GeometryClient | undefined; bootId?: number }>(
    undefined,
  );
  const autoRequestTriggerRef = useRef<{ paramsKey: string } | undefined>(undefined);
  const handledAutoEpisodeRef = useRef<number | undefined>(undefined);
  const handoverBootRef = useRef<{ client: GeometryClient; bootId: number } | undefined>(undefined);
  const adoptResult = useCallback(
    (
      next: GeometryResult,
      forParams = params,
      forFont = fontDefinition,
      forSubtitleFont = subtitleFontDefinition,
    ): void => {
      setResult(next);

      const key = geometryInputKey(forParams, forFont, forSubtitleFont);

      adoptedKeyRef.current = key;
      setResultParamsKey(key);
      setBusy(false);
      setError(undefined);
      setFailure(undefined);
      setDiagnostics(undefined);
    },
    [fontDefinition, params, subtitleFontDefinition],
  );

  useEffect(() => {
    isDisposingRef.current = false;
    const prewarmed = takePrewarmedGeometryClient();
    const client = prewarmed ?? new GeometryClient();
    const readyBoot = prewarmed?.bootInfo();

    handoverBootRef.current =
      readyBoot?.workerBootMs === undefined ? undefined : { client, bootId: readyBoot.bootId };
    clientRef.current = client;
    return () => {
      isDisposingRef.current = true;
      client.dispose();
    };
  }, []);

  useLayoutEffect(() => {
    isDisposingRef.current = false;
  }, [paramsKey]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (skipRequestKey === paramsKey) return undefined;
    if (adoptedKeyRef.current === paramsKey) {
      adoptedKeyRef.current = undefined;
      return;
    }
    if (autoRequestTriggerRef.current?.paramsKey !== paramsKey)
      autoRequestTriggerRef.current = undefined;
    let active = true;
    let attemptId: string | undefined;
    let terminal = false;
    const finishAttempt: GeometryAttemptCallbacks['finished'] = (id, outcome, details) => {
      if (terminal) return;
      terminal = true;
      if (outcome === 'error' && details?.failure)
        logError('geometry', `${details.failure.code}: ${details.failure.message ?? ''}`);
      attemptCallbacks?.finished(id, outcome, details);
    };
    const timer = window.setTimeout(
      () => {
        attemptId = crypto.randomUUID();
        const recoveryTrigger =
          autoRequestTriggerRef.current?.paramsKey === paramsKey ? 'auto_replacement' : undefined;

        autoRequestTriggerRef.current = undefined;
        attemptCallbacks?.started(attemptId, params, recoveryTrigger);
        setBusy(true);
        setError(undefined);
        setFailure(undefined);
        setDiagnostics(undefined);
        const client = clientRef.current;
        const request = client?.request(params, fontDefinition, subtitleFontDefinition);
        if (!request) {
          const cause = new Error('Geometry preview is not ready.');
          const nextFailure = failureFrom(cause, 'geometry-build-failed');

          setBusy(false);
          setFailure(nextFailure);
          setError(cause.message);
          finishAttempt(attemptId, 'error', { failure: nextFailure });
          return;
        }
        void request
          .then((next) => {
            const reported = reportedBootRef.current;
            const stampedBootId = next.timings?.bootId;
            const bootInfo =
              stampedBootId === undefined ? undefined : client?.bootInfo(stampedBootId);
            const handover = handoverBootRef.current;
            const attribution = attributeAdoptedBoot({
              active,
              lastReportedBootId: reported?.client === client ? reported?.bootId : undefined,
              info:
                bootInfo &&
                handover &&
                handover.client === client &&
                handover.bootId === bootInfo.bootId
                  ? { bootId: bootInfo.bootId }
                  : bootInfo,
              cacheHit: next.timings?.clientCacheHit === 1,
            });

            reportedBootRef.current = { client, bootId: attribution.reportedBootId };
            if (!active) return;
            finishAttempt(attemptId!, 'success', {
              generationId: next.generationId,
              timings: next.timings,
              boot: attribution.boot,
              workerReplacements: client?.workerReplacements,
            });
            adoptResult(next, params, fontDefinition, subtitleFontDefinition);
          })
          .catch((cause: Error) => {
            if (!active) return;
            if (
              cause instanceof GeometryCandidateSupersededError ||
              cause.message === 'Preview generation superseded.'
            ) {
              finishAttempt(attemptId!, 'superseded');
              return;
            }
            const failure = failureFrom(cause, 'geometry-build-failed');
            const operationDiagnostics =
              cause instanceof Error && 'diagnostics' in cause
                ? (cause as Error & { diagnostics?: OperationDiagnostics }).diagnostics
                : undefined;
            const episode = client?.autoRecoveryEpisodeId();
            if (
              episode !== undefined &&
              episode !== handledAutoEpisodeRef.current &&
              AUTO_REQUEST_FAILURE_CODES.has(failure.code)
            ) {
              handledAutoEpisodeRef.current = episode;
              autoRequestTriggerRef.current = { paramsKey };
              finishAttempt(attemptId!, 'error', {
                failure,
                diagnostics: operationDiagnostics,
                workerReplacements: client?.workerReplacements,
              });
              setRetryId((value) => value + 1);
              return;
            }
            setBusy(false);

            setFailure(failure);
            setDiagnostics(operationDiagnostics);
            setError(cause.message);
            finishAttempt(attemptId!, 'error', {
              failure,
              diagnostics: operationDiagnostics,
              workerReplacements: client?.workerReplacements,
            });
          });
      },
      resultRef.current ? 90 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (attemptId && !terminal)
        finishAttempt(attemptId, isDisposingRef.current ? 'cancelled' : 'superseded');
    };
  }, [
    adoptResult,
    attemptCallbacks,
    fontDefinition,
    params,
    paramsKey,
    resultParamsKey,
    retryId,
    skipRequestKey,
    subtitleFontDefinition,
  ]);

  return {
    clientRef,
    result,
    busy,
    error,
    failure,
    diagnostics,
    retry: () => {
      try {
        clientRef.current?.recoverForUserRetry();
      } catch (cause) {
        const nextFailure = failureFrom(cause, 'geometry-worker-failed');

        setFailure(nextFailure);
        setDiagnostics(
          cause instanceof Error && 'diagnostics' in cause
            ? (cause as Error & { diagnostics?: OperationDiagnostics }).diagnostics
            : undefined,
        );
        setError(nextFailure.message ?? 'Geometry worker failed.');
        setBusy(false);

        return;
      }
      adoptedKeyRef.current = undefined;
      setRetryId((value) => value + 1);
    },
    current: !busy && !error && resultParamsKey === paramsKey,
    paramsKey,
    resultParamsKey,
    adoptResult,
    setError,
  };
};
