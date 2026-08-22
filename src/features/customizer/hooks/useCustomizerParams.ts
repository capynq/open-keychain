import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  FONT_CATALOG,
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
  createGoogleFontProvider,
  createLocalFontStore,
  type LocalFontRecord,
  type FontDefinition,
} from '../../../domain/keychain';
import {
  PARAMETER_RANGES,
  hasActiveParameter,
  parameterRange,
  type CustomizerParameter,
  type ParameterRange,
  type ShapeParameter,
} from '../../../domain/keychain';
import { DEFAULT_PARAMS, type KeychainParams, type TemplateId } from '../../../domain/keychain';
import { STYLE_CATALOG, TEMPLATE_CATALOG } from '../../../domain/keychain';
import type { FontNotice } from '../model/customizer-types';
import { resetParamsForSection, type CustomizerResetSection } from '../model/reset';
import {
  randomizeParams,
  randomizeWithValidation,
  type RandomSource,
  type RandomizeTransaction,
  type RandomizeValidation,
} from '../model/randomizer';

export const useCustomizerParams = (
  initialParams?: KeychainParams,
): {
  params: KeychainParams;
  selectedFont: FontDefinition;
  fontForId: (id: string) => FontDefinition;
  googleFonts: FontDefinition[];
  googleLoading: boolean;
  googleError: string | undefined;
  loadGoogleFonts: () => Promise<void>;
  localFonts: LocalFontRecord[];
  importLocalFonts: (files: FileList | File[]) => Promise<void>;
  pickLocalFonts: () => Promise<void>;
  reconnectLocalFont: (id: string) => Promise<void>;
  removeLocalFont: (id: string) => Promise<void>;
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
  showsParameter: (parameter: CustomizerParameter) => boolean;
  rangeFor: (parameter: ShapeParameter) => ParameterRange;
  setParams: Dispatch<SetStateAction<KeychainParams>>;
  randomize: (
    random?: RandomSource,
    validate?: RandomizeValidation,
  ) => Promise<RandomizeTransaction>;
  undo: () => void;
  canUndo: boolean;
} => {
  const [params, setParams] = useState<KeychainParams>(() => ({
    ...DEFAULT_PARAMS,
    ...initialParams,
  }));
  // Keep an eagerly updated snapshot so an async randomization cannot commit
  // over an edit made while its validation request was pending.
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const previousParams = useRef<KeychainParams | undefined>(undefined);
  const [canUndo, setCanUndo] = useState(false);
  const setParamsDirect: Dispatch<SetStateAction<KeychainParams>> = (next) => {
    previousParams.current = undefined;
    setCanUndo(false);
    setParams(next);
  };

  const [fontNotice, setFontNotice] = useState<FontNotice>();
  const [googleFonts, setGoogleFonts] = useState<FontDefinition[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string>();
  const [localFonts, setLocalFonts] = useState<LocalFontRecord[]>([]);
  const [localStore] = useState(() => createLocalFontStore());
  const [provider] = useState(() =>
    createGoogleFontProvider({
      apiKey: import.meta.env.VITE_GOOGLE_FONTS_API_KEY,
    }),
  );
  const loadGoogleFonts = async (): Promise<void> => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setGoogleError(undefined);
    try {
      setGoogleFonts(await provider.list());
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : 'Google Fonts are unavailable.');
    } finally {
      setGoogleLoading(false);
    }
  };
  const allFonts = useMemo(
    () => [
      ...FONT_CATALOG,
      ...googleFonts,
      ...localFonts.flatMap((record) => (record.font ? [record.font] : [])),
    ],
    [googleFonts, localFonts],
  );

  useEffect(() => {
    void localStore.restore().then((restored) => {
      setLocalFonts((current) => [
        ...current,
        ...restored.filter((record) => !current.some((existing) => existing.id === record.id)),
      ]);
    });
  }, [localStore]);

  const selectedFont = useMemo(
    () =>
      [...allFonts, ...localFonts.flatMap((record) => (record.font ? [record.font] : []))].find(
        (font) => font.id === params.fontId,
      ) ?? FONT_CATALOG[0],
    [allFonts, localFonts, params.fontId],
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
    setParamsDirect((current) => ({ ...current, [key]: value }));
  };

  const updateText = (text: string): void => {
    const currentFont =
      allFonts.find((font) => font.id === params.fontId) ?? fontDefinition(params.fontId);
    const articulated = params.templateId === 'articulated-name';
    const compatible = articulated
      ? fontSupportsArticulatedName(currentFont, text)
      : fontSupportsText(currentFont, text);
    const replacement = compatible
      ? undefined
      : articulated
        ? articulatedFallbackFont(text)
        : allFonts.find((font) => fontSupportsText(font, text));
    if (replacement)
      setFontNotice({ font: currentFont.name, replacement: replacement.name, articulated });
    setParamsDirect((current) => ({
      ...current,
      text,
      fontId: replacement?.id ?? current.fontId,
    }));
  };

  const updateBackingSize = (value: number): void => {
    setFontNotice(undefined);
    setParamsDirect((current) => ({
      ...current,
      paddingMm: value,
      edgeInsetMm: value,
    }));
  };

  const selectTemplate = (templateId: TemplateId): void => {
    setFontNotice(undefined);
    const selected =
      allFonts.find((font) => font.id === params.fontId) ?? fontDefinition(params.fontId);
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
    setParamsDirect((current) => {
      const currentFont =
        allFonts.find((font) => font.id === current.fontId) ?? fontDefinition(current.fontId);
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
    setParamsDirect((current) => resetParamsForSection(current, section));
  };

  const reset = (): void => {
    setFontNotice(undefined);
    setParamsDirect({ ...DEFAULT_PARAMS });
  };
  const importLocalFonts = async (files: FileList | File[]): Promise<void> => {
    const imported = await localStore.importFiles(files);
    if (imported.length)
      setLocalFonts((current) => [
        ...current,
        ...imported.filter((record) => !current.some((existing) => existing.id === record.id)),
      ]);
  };
  const pickLocalFonts = async (): Promise<void> => {
    const imported = await localStore.pick();
    if (imported.length)
      setLocalFonts((current) => [
        ...current,
        ...imported.filter((record) => !current.some((existing) => existing.id === record.id)),
      ]);
  };
  const reconnectLocalFont = async (id: string): Promise<void> => {
    const record = await localStore.reconnect(id);
    if (record) setLocalFonts((current) => current.map((item) => (item.id === id ? record : item)));
  };
  const removeLocalFont = async (id: string): Promise<void> => {
    await localStore.remove(id);
    if (params.fontId === id)
      setParamsDirect((current) => ({ ...current, fontId: FONT_CATALOG[0].id }));
    setLocalFonts((current) => current.filter((item) => item.id !== id));
  };

  return {
    params,
    selectedFont,
    fontForId: (id) => allFonts.find((font) => font.id === id) ?? fontDefinition(id),
    googleFonts,
    googleLoading,
    googleError,
    loadGoogleFonts,
    localFonts,
    importLocalFonts,
    pickLocalFonts,
    reconnectLocalFont,
    removeLocalFont,
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
    showsParameter: (parameter) => hasActiveParameter(params, parameter),
    rangeFor: (parameter) => parameterRange(params, parameter),
    setParams: setParamsDirect,
    randomize: async (random, validate) => {
      const original = params;
      const transaction = validate
        ? await randomizeWithValidation(original, validate, { random, fonts: allFonts })
        : {
            status: 'accepted' as const,
            params: randomizeParams(original, { random, fonts: allFonts }),
            attempts: 1,
          };
      if (JSON.stringify(paramsRef.current) !== JSON.stringify(original)) {
        return {
          status: 'cancelled' as const,
          params: paramsRef.current,
          attempts: transaction.attempts,
        };
      }
      if (transaction.status === 'accepted') {
        previousParams.current = original;
        setCanUndo(true);
        setParams(transaction.params);
      }
      return transaction;
    },
    undo: () => {
      const previous = previousParams.current;
      if (!previous) return;
      previousParams.current = undefined;
      setCanUndo(false);
      setParams(previous);
    },
    canUndo,
  };
};

export { PARAMETER_RANGES };
