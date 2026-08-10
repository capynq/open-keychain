import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  FONT_CATALOG,
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
} from '../../../domain/keychain';
import { PARAMETER_RANGES, hasTemplateParameter } from '../../../domain/keychain';
import { DEFAULT_PARAMS, normalizeParams, type KeychainParams, type TemplateId } from '../../../domain/keychain';
import { STYLE_CATALOG, TEMPLATE_CATALOG } from '../../../domain/keychain';
import type { FontNotice } from '../model/customizer-types';

export const useCustomizerParams = (): {
  params: KeychainParams;
  selectedFont: (typeof FONT_CATALOG)[number];
  activeTemplate: (typeof TEMPLATE_CATALOG)[number];
  availableStyles: typeof STYLE_CATALOG;
  usesCyrillic: boolean;
  fontNotice: FontNotice | undefined;
  update: <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => void;
  updateText: (text: string) => void;
  selectTemplate: (templateId: TemplateId) => void;
  showsParameter: (parameter: keyof KeychainParams) => boolean;
  setParams: Dispatch<SetStateAction<KeychainParams>>;
} => {
  const [params, setParams] = useState<KeychainParams>(() => {
    try {
      const saved = localStorage.getItem('open-keychain-preferences');
      const next = saved ? normalizeParams({ ...DEFAULT_PARAMS, ...JSON.parse(saved) }) : DEFAULT_PARAMS;
      const current = fontDefinition(next.fontId);
      if (next.templateId === 'articulated-name' && !fontSupportsArticulatedName(current, next.text))
        next.fontId = articulatedFallbackFont(next.text).id;
      else if (!fontSupportsText(current, next.text))
        next.fontId = FONT_CATALOG.find((font) => fontSupportsText(font, next.text))?.id ?? DEFAULT_PARAMS.fontId;
      return next;
    } catch {
      return DEFAULT_PARAMS;
    }
  });
  const [fontNotice, setFontNotice] = useState<FontNotice>();
  const selectedFont = useMemo(
    () => FONT_CATALOG.find((font) => font.id === params.fontId) ?? FONT_CATALOG[0],
    [params.fontId],
  );
  const activeTemplate = useMemo(
    () => TEMPLATE_CATALOG.find((template) => template.id === params.templateId) ?? TEMPLATE_CATALOG[0],
    [params.templateId],
  );
  const availableStyles = useMemo(
    () => STYLE_CATALOG.filter((style) => activeTemplate.styles.includes(style.id)),
    [activeTemplate],
  );
  const usesCyrillic = textUsesCyrillic(params.text);
  useEffect(() => {
    localStorage.setItem(
      'open-keychain-preferences',
      JSON.stringify({
        fontId: params.fontId,
        templateId: params.templateId,
        styleId: params.styleId,
        textHeightMm: params.textHeightMm,
        baseThicknessMm: params.baseThicknessMm,
        reliefDepthMm: params.reliefDepthMm,
        paddingMm: params.paddingMm,
        letterSpacingMm: params.letterSpacingMm,
        holeDiameterMm: params.holeDiameterMm,
        connectorWidthMm: params.connectorWidthMm,
        cornerRadiusMm: params.cornerRadiusMm,
        stakeLengthMm: params.stakeLengthMm,
        nameplateTiltDeg: params.nameplateTiltDeg,
        nameplateEmbedMm: params.nameplateEmbedMm,
        jointClearanceMm: params.jointClearanceMm,
        mechanicalGapMm: params.mechanicalGapMm,
        maxJointAngleDeg: params.maxJointAngleDeg,
        minimumWallMm: params.minimumWallMm,
        bottomClearanceMm: params.bottomClearanceMm,
      }),
    );
  }, [params]);
  const update = <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]): void => {
    setFontNotice(undefined);
    setParams((current) => ({ ...current, [key]: value }));
  };
  const updateText = (text: string): void => {
    const currentFont = fontDefinition(params.fontId);
    const articulated = params.templateId === 'articulated-name';
    const compatible = articulated
      ? fontSupportsArticulatedName(currentFont, text)
      : fontSupportsText(currentFont, text);
    const replacement = compatible
      ? undefined
      : articulated
        ? articulatedFallbackFont(text)
        : FONT_CATALOG.find((font) => fontSupportsText(font, text));
    if (replacement) setFontNotice({ font: currentFont.name, replacement: replacement.name, articulated });
    setParams((current) => ({ ...current, text, fontId: replacement?.id ?? current.fontId }));
  };
  const selectTemplate = (templateId: TemplateId): void => {
    setFontNotice(undefined);
    const selected = fontDefinition(params.fontId);
    const previewReplacement =
      templateId === 'articulated-name' && !fontSupportsArticulatedName(selected, params.text)
        ? articulatedFallbackFont(params.text)
        : undefined;
    if (previewReplacement)
      setFontNotice({ font: selected.name, replacement: previewReplacement.name, articulated: true });
    setParams((current) => {
      const currentFont = fontDefinition(current.fontId);
      const replacement =
        templateId === 'articulated-name' && !fontSupportsArticulatedName(currentFont, current.text)
          ? articulatedFallbackFont(current.text)
          : undefined;
      return {
        ...current,
        templateId,
        fontId: replacement?.id ?? current.fontId,
        baseThicknessMm:
          templateId === 'articulated-name' ? Math.max(3.4, current.baseThicknessMm) : current.baseThicknessMm,
      };
    });
  };
  return {
    params,
    selectedFont,
    activeTemplate,
    availableStyles,
    usesCyrillic,
    fontNotice,
    update,
    updateText,
    selectTemplate,
    showsParameter: (parameter) => hasTemplateParameter(params.templateId, parameter),
    setParams,
  };
};

export { PARAMETER_RANGES };
