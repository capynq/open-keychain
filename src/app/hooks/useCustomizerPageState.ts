import { useEffect, useReducer, useRef, useState, type SetStateAction } from 'react';
import { DEFAULT_PARAMS, encodeDesignDocument, normalizeParams } from '../../domain/keychain';
import type { KeychainParams, PrintAppearanceOverrides } from '../../domain/keychain';
import { styleName, t, templateName, type Locale } from '../../infrastructure/i18n';
import { useCustomizerParams, useGeometryGeneration } from '../../features/customizer';
import { useExportActions } from '../../features/export';
import { useHostedAccount } from '../../features/hosted';
import { previewStatus, type SurfacePresetId } from '../../features/preview';
import { useAnalytics } from '../../infrastructure/telemetry';
import { useCustomizerGuide } from './useCustomizerGuide';

export const useCustomizerPageState = (
  locale: Locale,
  initialParams?: KeychainParams,
  initialAppearanceOverrides?: PrintAppearanceOverrides,
  routeInputKey?: string,
) => {
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>('matte');
  const [exportOpen, setExportOpen] = useState(false);
  const [appearanceOverrides, setAppearanceOverrides] = useReducer(
    (current: PrintAppearanceOverrides, next: SetStateAction<PrintAppearanceOverrides>) =>
      typeof next === 'function' ? next(current) : next,
    initialAppearanceOverrides ?? { version: 1 },
  );
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'manual' | 'failed'>('idle');
  const [randomizing, setRandomizing] = useState(false);
  const [randomizeFailure, setRandomizeFailure] = useState(false);
  const { track } = useAnalytics();
  const customizer = useCustomizerParams(initialParams);
  const geometry = useGeometryGeneration(customizer.params, customizer.selectedFont);
  const hosted = useHostedAccount(
    customizer.params,
    (projectParams) => {
      customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...projectParams }));
    },
    locale,
  );
  const exportState = useExportActions({
    geometry,
    params: customizer.params,
    fontDefinition: customizer.selectedFont,
    appearanceOverrides,
  });
  const guide = useCustomizerGuide();
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
  }, [customizer, initialAppearanceOverrides, initialParams, routeInputKey]);

  useEffect(() => {
    if (shareStatus === 'idle') return undefined;
    const timeout = window.setTimeout(() => setShareStatus('idle'), 4_000);

    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  const shareDesign = async (): Promise<void> => {
    try {
      const url = new URL(window.location.href);

      url.searchParams.set(
        'design',
        encodeDesignDocument({ version: 2, params: customizer.params, appearanceOverrides }),
      );
      const value = url.toString();
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          setShareStatus('copied');
          return;
        } catch {
          // Continue with the legacy clipboard and manual-copy fallbacks.
        }
      }
      const textarea = document.createElement('textarea');

      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');

      textarea.remove();
      if (copied) setShareStatus('copied');
      else if (window.prompt(t(locale, 'shareManualPrompt'), value) !== null)
        setShareStatus('manual');
      else setShareStatus('failed');
    } catch {
      setShareStatus('failed');
    }
  };
  const activeStyle = customizer.availableStyles.find(
    (style) => style.id === customizer.params.styleId,
  );
  const lastTemplate = useRef(customizer.params.templateId);
  const lastGeometryError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastTemplate.current !== customizer.params.templateId) {
      track('template_selected', { template: customizer.params.templateId, locale });
      lastTemplate.current = customizer.params.templateId;
    }
  }, [customizer.params.templateId, locale, track]);

  useEffect(() => {
    if (geometry.result?.printable) {
      track('geometry_ready', { template: customizer.params.templateId, locale });
    }
    if (geometry.error && geometry.error !== lastGeometryError.current) {
      track('geometry_error', {
        template: customizer.params.templateId,
        locale,
        category: 'generation',
      });
      lastGeometryError.current = geometry.error;
    }
  }, [customizer.params.templateId, geometry.error, geometry.result?.printable, locale, track]);

  const randomize = (): void => {
    if (randomizing) return;
    setRandomizing(true);
    setRandomizeFailure(false);
    void customizer
      .randomize(undefined, async (candidate) => {
        const client = geometry.clientRef.current;
        if (!client) return false;
        return client.validate(candidate, customizer.fontForId(candidate.fontId));
      })
      .then((transaction) => {
        if (transaction.status === 'cancelled') {
          setRandomizing(false);
          return;
        }
        if (transaction.status === 'accepted') {
          const candidateFont = customizer.fontForId(transaction.params.fontId);
          if (transaction.result)
            geometry.adoptResult(transaction.result, transaction.params, candidateFont);
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
    appearanceOverrides,
    setAppearanceOverrides,
    shareDesign,
    shareStatus,
    randomizing,
    randomizeFailure,
    randomize,
    undo,
    status: previewStatus(geometry, locale),
    modelInfo: {
      template: templateName(locale, customizer.activeTemplate.id, customizer.activeTemplate.name),
      style: activeStyle ? styleName(locale, activeStyle.id, activeStyle.name) : undefined,
      font: customizer.selectedFont.name,
    },
    guide,
  };
};

export type CustomizerPageState = ReturnType<typeof useCustomizerPageState>;
