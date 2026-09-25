import { useEffect, useReducer, useRef, useState, type SetStateAction } from 'react';

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
  useGeometryGeneration,
} from '../../features/customizer/hooks/useGeometryGeneration';
import { useExportActions } from '../../features/export/model/use-export-actions';
import { useHostedAccount } from '../../features/hosted/hooks/useHostedAccount';
import { previewStatus } from '../../features/preview/model/preview-status';
import { useShareDesign } from '../../features/share/useShareDesign';
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
  const [skipRequestKey, setSkipRequestKey] = useState<string>();
  const geometryRef = useRef<ReturnType<typeof useGeometryGeneration> | undefined>(undefined);
  const [candidateCallbacks] = useState<CandidateCallbacks>(() => ({
    pending: (params, font, subtitleFont) =>
      setSkipRequestKey(geometryInputKey(params, font, subtitleFont)),
    validate: (params, font, subtitleFont) => {
      const client = geometryRef.current?.clientRef.current;

      return client
        ? client.validate(params, font, subtitleFont)
        : Promise.reject(new Error('Geometry validation is not ready.'));
    },
    accept: (params, result, font, subtitleFont) => {
      geometryRef.current?.adoptResult(result, params, font, subtitleFont);
      setSkipRequestKey(undefined);
    },
    reject: (params, font, subtitleFont) => {
      const currentGeometry = geometryRef.current;
      if (currentGeometry?.result)
        currentGeometry.adoptResult(currentGeometry.result, params, font, subtitleFont);
      setSkipRequestKey(undefined);
    },
  }));
  const { track } = useAnalytics();
  const customizer = useCustomizerParams(initialParams, candidateCallbacks);
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
  const geometry = useGeometryGeneration(
    customizer.params,
    customizer.selectedFont,
    customizer.selectedSubtitleFont,
    skipRequestKey,
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
    !geometry.busy &&
    !geometry.error &&
    Boolean(
      geometry.result &&
      geometry.current !== false &&
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
  });
  const openExport = (): void => {
    if (canExport) setExportOpen(true);
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

    customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...initialParams }));
    setAppearanceOverrides(initialAppearanceOverrides ?? { version: 1 });
    setDisconnectedAcknowledgedSignature(undefined);
  }, [customizer, initialAppearanceOverrides, initialParams, routeInputKey]);

  const activeStyle = STYLE_CATALOG.find((style) => style.id === customizer.acceptedParams.styleId);
  const lastTemplate = useRef(customizer.acceptedParams.templateId);
  const lastGeometryError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastTemplate.current !== customizer.acceptedParams.templateId) {
      track('template_selected', { template: customizer.acceptedParams.templateId, locale });
      lastTemplate.current = customizer.acceptedParams.templateId;
    }
  }, [customizer.acceptedParams.templateId, locale, track]);

  useEffect(() => {
    if (geometry.result?.printable) {
      track('geometry_ready', { template: customizer.acceptedParams.templateId, locale });
    }
    if (geometry.error && geometry.error !== lastGeometryError.current) {
      track('geometry_error', {
        template: customizer.acceptedParams.templateId,
        locale,
        category: 'generation',
      });
      lastGeometryError.current = geometry.error;
    }
  }, [
    customizer.acceptedParams.templateId,
    geometry.error,
    geometry.result?.printable,
    locale,
    track,
  ]);

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

  useEffect(() => {
    if (!exportOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setExportOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [exportOpen]);

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
    shareDesign: share.shareDesign,
    shareStatus: share.shareStatus,
    shareFontFallback: share.shareFontFallback,
    shareUrl: share.shareUrl,
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
