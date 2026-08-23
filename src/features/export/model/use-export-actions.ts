import { useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { completeExportIntent, requestExportIntent } from '../../hosted/api/hosted-api';
import { hostedMode } from '../../hosted/config';
import type { GeometryClient } from '../../../infrastructure/geometry';
import type {
  ExportFormat,
  GeometryResult,
  KeychainParams,
  ThreeMfMode,
  PrintAppearanceOverrides,
} from '../../../domain/keychain';
import type { FontDefinition } from '../../../domain/keychain/fonts/catalog';
import { useAnalytics } from '../../../infrastructure/telemetry';

export type ExportActionsState = {
  downloading: boolean;
  printable: boolean;
  status: 'idle' | 'exporting' | 'success' | 'error';
  error?: string;
  download: (format: ExportFormat, mode?: ThreeMfMode) => Promise<void>;
  retry: () => Promise<void>;
  clearStatus: () => void;
};

type ExportSource = {
  clientRef: MutableRefObject<GeometryClient | undefined>;
  result: GeometryResult | undefined;
  current?: boolean;
  setError: Dispatch<SetStateAction<string | undefined>>;
};

export const useExportActions = ({
  geometry,
  params,
  fontDefinition,
  subtitleFontDefinition,
  appearanceOverrides,
}: {
  geometry: ExportSource;
  params: KeychainParams;
  fontDefinition?: FontDefinition;
  subtitleFontDefinition?: FontDefinition;
  appearanceOverrides?: PrintAppearanceOverrides;
}): ExportActionsState => {
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<ExportActionsState['status']>('idle');
  const [error, setError] = useState<string>();
  const lastRequest = useRef<{
    format: ExportFormat;
    mode: ThreeMfMode;
    appearanceOverrides?: PrintAppearanceOverrides;
  }>(undefined);
  const { track } = useAnalytics();

  const download = async (
    format: ExportFormat,
    mode: ThreeMfMode = 'separate-colors',
    requestedAppearanceOverrides: PrintAppearanceOverrides | undefined = appearanceOverrides,
  ): Promise<void> => {
    if (!geometry.result?.printable || geometry.current === false || downloading) return;
    lastRequest.current = { format, mode, appearanceOverrides: requestedAppearanceOverrides };
    setDownloading(true);
    setStatus('exporting');
    setError(undefined);
    track('export_started', { format, mode, template: params.templateId });
    let exportToken: string | undefined;
    try {
      if (hostedMode) exportToken = (await requestExportIntent()).token;
      const file = await geometry.clientRef.current?.export(
        params,
        format,
        mode,
        fontDefinition,
        requestedAppearanceOverrides,
        subtitleFontDefinition,
      );
      if (!file) throw new Error('The file could not be created.');
      const url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (exportToken) await completeExportIntent(exportToken);
      track('export_completed', { format, mode, template: params.templateId });
      setStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The file could not be created.';

      setError(message);
      setStatus('error');
      geometry.setError(message);
      track('export_failed', { format, mode, template: params.templateId, category: 'generation' });
    } finally {
      setDownloading(false);
    }
  };

  const retry = async (): Promise<void> => {
    if (lastRequest.current)
      await download(
        lastRequest.current.format,
        lastRequest.current.mode,
        lastRequest.current.appearanceOverrides,
      );
  };

  return {
    downloading,
    printable: Boolean(geometry.result?.printable && geometry.current !== false),
    status,
    error,
    download,
    retry,
    clearStatus: () => {
      setStatus('idle');
      setError(undefined);
    },
  };
};
