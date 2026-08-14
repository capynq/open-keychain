import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  FONT_CATALOG,
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
} from '../../../domain/keychain';
import {
  PARAMETER_RANGES,
  hasActiveParameter,
  parameterRange,
  type ParameterRange,
  type ShapeParameter,
} from '../../../domain/keychain';
import { DEFAULT_PARAMS, type KeychainParams, type TemplateId } from '../../../domain/keychain';
import { STYLE_CATALOG, TEMPLATE_CATALOG } from '../../../domain/keychain';
import type { FontNotice } from '../model/customizer-types';
import { resetParamsForSection, type CustomizerResetSection } from '../model/reset';

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
  updateBackingSize: (value: number) => void;
  resetSection: (section: CustomizerResetSection) => void;
  reset: () => void;
  showsParameter: (parameter: keyof KeychainParams) => boolean;
  rangeFor: (parameter: ShapeParameter) => ParameterRange;
  setParams: Dispatch<SetStateAction<KeychainParams>>;
} => {
  const [params, setParams] = useState<KeychainParams>(() => ({ ...DEFAULT_PARAMS }));

  const [fontNotice, setFontNotice] = useState<FontNotice>();

  const selectedFont = useMemo(
    () => FONT_CATALOG.find((font) => font.id === params.fontId) ?? FONT_CATALOG[0],
    [params.fontId],
  );

  const activeTemplate = useMemo(
    () =>
      TEMPLATE_CATALOG.find((template) => template.id === params.templateId) ?? TEMPLATE_CATALOG[0],
    [params.templateId],
  );

  const availableStyles = useMemo(
    () => STYLE_CATALOG.filter((style) => activeTemplate.styles.includes(style.id)),
    [activeTemplate],
  );

  const usesCyrillic = textUsesCyrillic(params.text);

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
    if (replacement)
      setFontNotice({ font: currentFont.name, replacement: replacement.name, articulated });
    setParams((current) => ({ ...current, text, fontId: replacement?.id ?? current.fontId }));
  };

  const updateBackingSize = (value: number): void => {
    setFontNotice(undefined);
    setParams((current) => ({
      ...current,
      paddingMm: value,
      edgeInsetMm: value,
    }));
  };

  const selectTemplate = (templateId: TemplateId): void => {
    setFontNotice(undefined);
    const selected = fontDefinition(params.fontId);
    const previewReplacement =
      templateId === 'articulated-name' && !fontSupportsArticulatedName(selected, params.text)
        ? articulatedFallbackFont(params.text)
        : undefined;
    if (previewReplacement)
      setFontNotice({
        font: selected.name,
        replacement: previewReplacement.name,
        articulated: true,
      });
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
          templateId === 'articulated-name'
            ? Math.max(3.4, current.baseThicknessMm)
            : current.baseThicknessMm,
      };
    });
  };

  const resetSection = (section: CustomizerResetSection): void => {
    setFontNotice(undefined);
    setParams((current) => resetParamsForSection(current, section));
  };

  const reset = (): void => {
    setFontNotice(undefined);
    setParams({ ...DEFAULT_PARAMS });
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
    updateBackingSize,
    selectTemplate,
    resetSection,
    reset,
    showsParameter: (parameter) => hasActiveParameter(params, parameter as ShapeParameter),
    rangeFor: (parameter) => parameterRange(params, parameter),
    setParams,
  };
};

export { PARAMETER_RANGES };
