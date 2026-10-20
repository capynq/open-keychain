import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { failureFrom } from '@/shared/lib/recovery/failure';

import type { FontDefinition } from '../../../domain/keychain/fonts/catalog';
import type { GeometryResult, KeychainParams } from '../../../domain/keychain/model/types';

import {
  GeometryClient,
  GeometryCandidateSupersededError,
} from '../../../infrastructure/geometry/geometry-client';

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
): {
  clientRef: MutableRefObject<GeometryClient | undefined>;
  result: GeometryResult | undefined;
  busy: boolean;
  error: string | undefined;
  failure: RecoveryFailure | undefined;
  retry: () => void;
  current: boolean;
  paramsKey: string;
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
  const [retryId, setRetryId] = useState(0);
  const paramsKey = geometryInputKey(params, fontDefinition, subtitleFontDefinition);
  const [resultParamsKey, setResultParamsKey] = useState<string>();
  const adoptedKeyRef = useRef<string | undefined>(undefined);
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
    },
    [fontDefinition, params, subtitleFontDefinition],
  );

  useEffect(() => {
    const client = new GeometryClient();

    clientRef.current = client;
    return () => client.dispose();
  }, []);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (skipRequestKey === paramsKey) return undefined;
    if (adoptedKeyRef.current === paramsKey) {
      adoptedKeyRef.current = undefined;
      return;
    }
    let active = true;
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        setError(undefined);
        setFailure(undefined);
        clientRef.current
          ?.request(params, fontDefinition, subtitleFontDefinition)
          .then((next) => {
            if (!active) return;
            adoptResult(next, params, fontDefinition, subtitleFontDefinition);
          })
          .catch((cause: Error) => {
            if (
              !active ||
              cause instanceof GeometryCandidateSupersededError ||
              cause.message === 'Preview generation superseded.'
            )
              return;
            setBusy(false);
            const failure = failureFrom(cause, 'geometry-build-failed');

            setFailure(failure);
            setError(cause.message);
          });
      },
      resultRef.current ? 90 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    adoptResult,
    fontDefinition,
    params,
    paramsKey,
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
    retry: () => {
      try {
        clientRef.current?.recoverForUserRetry();
      } catch (cause) {
        const nextFailure = failureFrom(cause, 'geometry-worker-failed');

        setFailure(nextFailure);
        setError(nextFailure.message ?? 'Geometry worker failed.');
        setBusy(false);

        return;
      }
      adoptedKeyRef.current = undefined;
      setRetryId((value) => value + 1);
    },
    current: !busy && !error && resultParamsKey === paramsKey,
    paramsKey,
    adoptResult,
    setError,
  };
};
