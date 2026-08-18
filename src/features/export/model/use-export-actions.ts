import { useState, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { completeExportIntent, hostedMode, requestExportIntent } from '../../hosted';
import type { GeometryClient } from '../../../infrastructure/geometry';
import type {
  ExportFormat,
  GeometryResult,
  KeychainParams,
  ThreeMfMode,
} from '../../../domain/keychain';
import { useAnalytics } from '../../../infrastructure/telemetry';

export type ExportActionsState = {
  downloading: boolean;
  printable: boolean;
  download: (format: ExportFormat, mode?: ThreeMfMode) => Promise<void>;
};

type ExportSource = {
  clientRef: MutableRefObject<GeometryClient | undefined>;
  result: GeometryResult | undefined;
  setError: Dispatch<SetStateAction<string | undefined>>;
};

export const useExportActions = ({
  geometry,
  params,
}: {
  geometry: ExportSource;
  params: KeychainParams;
}): ExportActionsState => {
  const [downloading, setDownloading] = useState(false);
  const { track } = useAnalytics();

  const download = async (
    format: ExportFormat,
    mode: ThreeMfMode = 'separate-colors',
  ): Promise<void> => {
    if (!geometry.result?.printable || downloading) return;
    setDownloading(true);
    track('export_started', { format, mode, template: params.templateId });
    let exportToken: string | undefined;
    try {
      if (hostedMode) exportToken = (await requestExportIntent()).token;
      const file = await geometry.clientRef.current?.export(params, format, mode);
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (exportToken) await completeExportIntent(exportToken);
      track('export_completed', { format, mode, template: params.templateId });
    } catch (cause) {
      geometry.setError(cause instanceof Error ? cause.message : 'The file could not be created.');
      track('export_failed', { format, mode, template: params.templateId, category: 'generation' });
    } finally {
      setDownloading(false);
    }
  };

  return { downloading, printable: Boolean(geometry.result?.printable), download };
};
