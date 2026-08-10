import { useState, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { completeExportIntent, hostedMode, requestExportIntent } from '../../hosted';
import type { GeometryClient } from '../../../infrastructure/geometry';
import type { ExportFormat, GeometryResult, KeychainParams, ThreeMfMode } from '../../../domain/keychain';

export const useExportActions = (
  clientRef: MutableRefObject<GeometryClient | undefined>,
  result: GeometryResult | undefined,
  params: KeychainParams,
  setError: Dispatch<SetStateAction<string | undefined>>,
): {
  downloading: boolean;
  download: (format: ExportFormat, mode?: ThreeMfMode) => Promise<void>;
} => {
  const [downloading, setDownloading] = useState(false);
  const download = async (format: ExportFormat, mode: ThreeMfMode = 'separate-colors'): Promise<void> => {
    if (!result?.printable || downloading) return;
    setDownloading(true);
    let exportToken: string | undefined;
    try {
      if (hostedMode) exportToken = (await requestExportIntent()).token;
      const file = await clientRef.current?.export(params, format, mode);
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (exportToken) await completeExportIntent(exportToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The file could not be created.');
    } finally {
      setDownloading(false);
    }
  };
  return { downloading, download };
};
