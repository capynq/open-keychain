import { useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';

import type { FontDefinition } from '../../../domain/keychain/fonts/catalog';
import type {
  ExportFormat,
  GeometryResult,
  KeychainParams,
  ThreeMfMode,
  PrintAppearanceOverrides,
} from '../../../domain/keychain/model/types';
import type { GeometryClient } from '../../../infrastructure/geometry/geometry-client';
import type { RecoveryFailure } from '../../../shared/lib/recovery/failure';

import { useAnalytics } from '../../../infrastructure/telemetry/useTelemetry';
import { failureFrom } from '../../../shared/lib/recovery/failure';
import {
  GeometryOperationError,
  type OperationDiagnostics,
} from '../../../shared/lib/recovery/operation-diagnostics';

export type ExportActionsState = {
  downloading: boolean;
  printable: boolean;
  status: 'idle' | 'exporting' | 'success' | 'error';
  error?: string;
  failure?: RecoveryFailure;
  download: (format: ExportFormat, mode?: ThreeMfMode) => Promise<void>;
  retry: () => Promise<void>;
  clearStatus: () => void;
};

const exportErrorCode = (
  cause: unknown,
  failure: RecoveryFailure,
): 'timeout' | 'geometry_failed' | 'worker_failed' | 'export_failed' => {
  if (cause instanceof GeometryOperationError) {
    if (cause.diagnostics.type === 'timeout') return 'timeout';
    if (['message_error', 'worker_error', 'worker_unavailable'].includes(cause.diagnostics.type))
      return 'worker_failed';
    if (cause.diagnostics.stage === 'initialization') return 'worker_failed';
    if (cause.diagnostics.stage === 'generation') return 'geometry_failed';
    return 'export_failed';
  }
  if (failure.code === 'geometry-request-timeout') return 'timeout';
  if (failure.code === 'geometry-worker-failed') return 'worker_failed';
  if (failure.code.startsWith('geometry-') && failure.code !== 'geometry-export-failed')
    return 'geometry_failed';
  const message = failure.message ?? (cause instanceof Error ? cause.message : '');
  if (/timed out/i.test(message)) return 'timeout';
  if (/worker/i.test(message)) return 'worker_failed';
  return 'export_failed';
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
  exportAllowed = true,
  allowDisconnected = false,
  designId,
}: {
  geometry: ExportSource;
  params: KeychainParams;
  fontDefinition?: FontDefinition;
  subtitleFontDefinition?: FontDefinition;
  appearanceOverrides?: PrintAppearanceOverrides;
  exportAllowed?: boolean;
  allowDisconnected?: boolean;
  designId: string;
}): ExportActionsState => {
  const disconnectedOnly = Boolean(
    geometry.result &&
    geometry.result.issues.some((issue) => issue.severity === 'error') &&
    geometry.result.issues
      .filter((issue) => issue.severity === 'error')
      .every((issue) => issue.code === 'disconnected'),
  );
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<ExportActionsState['status']>('idle');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<RecoveryFailure>();
  const inFlight = useRef(false);
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
    if (!exportAllowed || geometry.current === false || inFlight.current) return;
    lastRequest.current = { format, mode, appearanceOverrides: requestedAppearanceOverrides };
    const attemptId = crypto.randomUUID();
    const startedAt = performance.now();

    inFlight.current = true;
    setDownloading(true);
    setStatus('exporting');
    setError(undefined);
    setFailure(undefined);
    let failureStage: OperationDiagnostics['stage'] = 'transport';

    track('export_started', {
      format,
      mode,
      template: params.templateId,
      export_attempt_id: attemptId,
      design_id: designId,
    });
    try {
      geometry.clientRef.current?.recoverForUserRetry();
      const file = await geometry.clientRef.current?.export(
        params,
        format,
        mode,
        fontDefinition,
        requestedAppearanceOverrides,
        subtitleFontDefinition,
        allowDisconnected,
      );
      if (!file) throw new Error('The file could not be created.');
      failureStage = 'download';
      let url: string | undefined;
      const revokeUrl = () => {
        if (!url) return;
        URL.revokeObjectURL(url);
        url = undefined;
      };

      url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = file.filename;
      try {
        anchor.click();
      } catch (cause) {
        revokeUrl();

        throw cause;
      }
      window.setTimeout(revokeUrl, 1000);
      track('export_completed', {
        format,
        mode,
        template: params.templateId,
        export_attempt_id: attemptId,
        design_id: designId,
        duration_ms: Math.round(performance.now() - startedAt),
        outcome: 'success',
      });
      setStatus('success');
    } catch (cause) {
      const recoveryFailure = failureFrom(cause, 'geometry-export-failed');
      const diagnostics: OperationDiagnostics =
        cause instanceof GeometryOperationError
          ? cause.diagnostics
          : { stage: failureStage, type: 'operation_error' };
      const message = recoveryFailure.message ?? 'The file could not be created.';

      setError(message);
      setFailure(recoveryFailure);
      setStatus('error');
      track('export_failed', {
        format,
        mode,
        template: params.templateId,
        category: 'export',
        operation: 'export',
        export_attempt_id: attemptId,
        design_id: designId,
        duration_ms: Math.round(performance.now() - startedAt),
        outcome: 'error',
        error_code: exportErrorCode(cause, recoveryFailure),
        failure_stage: diagnostics.stage,
        error_type: diagnostics.type,
      });
    } finally {
      inFlight.current = false;
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
    printable: Boolean(
      exportAllowed &&
      geometry.current !== false &&
      (geometry.result?.printable || (allowDisconnected && disconnectedOnly)),
    ),
    status,
    error,
    failure,
    download,
    retry,
    clearStatus: () => {
      setStatus('idle');
      setError(undefined);
      setFailure(undefined);
    },
  };
};
