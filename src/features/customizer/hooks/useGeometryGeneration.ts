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

export const useGeometryGeneration = (
  params: KeychainParams,
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
          ?.request(params)
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
  }, [params]);

  return { clientRef, result, busy, error, setError };
};
