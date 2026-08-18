import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { GeometryClient } from '../../../infrastructure/geometry';
import type { GeometryResult, KeychainParams } from '../../../domain/keychain';
import type { FontDefinition } from '../../../domain/keychain/fonts/catalog';

export const useGeometryGeneration = (
  params: KeychainParams,
  fontDefinition?: FontDefinition,
): {
  clientRef: MutableRefObject<GeometryClient | undefined>;
  result: GeometryResult | undefined;
  busy: boolean;
  error: string | undefined;
  setError: Dispatch<SetStateAction<string | undefined>>;
} => {
  const clientRef = useRef<GeometryClient | undefined>(undefined);
  const resultRef = useRef<GeometryResult | undefined>(undefined);
  const [result, setResult] = useState<GeometryResult>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const client = new GeometryClient();

    clientRef.current = client;
    return () => client.dispose();
  }, []);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        setError(undefined);
        clientRef.current
          ?.request(params, fontDefinition)
          .then((next) => {
            setResult(next);
            setBusy(false);
          })
          .catch((cause: Error) => {
            setBusy(false);
            setError(cause.message);
          });
      },
      resultRef.current ? 90 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [params, fontDefinition]);

  return { clientRef, result, busy, error, setError };
};
