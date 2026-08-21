import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PARAMS, normalizeParams } from '../../domain/keychain';
import type { KeychainParams, PrintAppearanceOverrides } from '../../domain/keychain';
import { styleName, templateName, type Locale } from '../../infrastructure/i18n';
import { useCustomizerParams, useGeometryGeneration } from '../../features/customizer';
import { useExportActions } from '../../features/export';
import { useHostedAccount } from '../../features/hosted';
import { previewStatus, type SurfacePresetId } from '../../features/preview';
import { useAnalytics } from '../../infrastructure/telemetry';
import { useCustomizerGuide } from './useCustomizerGuide';

export const useCustomizerPageState = (locale: Locale, initialParams?: KeychainParams) => {
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>('matte');
  const [exportOpen, setExportOpen] = useState(false);
  const [appearanceOverrides, setAppearanceOverrides] = useState<PrintAppearanceOverrides>({
    version: 1,
  });
  const { track } = useAnalytics();
  const customizer = useCustomizerParams(initialParams);
  const geometry = useGeometryGeneration(customizer.params, customizer.selectedFont);
  const hosted = useHostedAccount(customizer.params, (projectParams) => {
    customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...projectParams }));
  });
  const exportState = useExportActions({
    geometry,
    params: customizer.params,
    fontDefinition: customizer.selectedFont,
    appearanceOverrides,
  });
  const guide = useCustomizerGuide();
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
