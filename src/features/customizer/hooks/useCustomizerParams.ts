import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { GeometryResult } from '../../../domain/keychain/model/types';
import type { FontNotice } from '../model/customizer-types';

import {
  FONT_CATALOG,
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
  type FontDefinition,
} from '../../../domain/keychain/fonts/catalog';
import { createGoogleFontProvider } from '../../../domain/keychain/fonts/google-provider';
import {
  createLocalFontStore,
  type LocalFontRecord,
} from '../../../domain/keychain/fonts/local-provider';
import {
  hasActiveParameter,
  PARAMETER_REGISTRY,
  parameterPresentationGroup,
  parameterRange,
  type CustomizerParameter,
  type ParameterRange,
  type ShapeParameter,
} from '../../../domain/keychain/model/parameters';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  type KeychainParams,
  type TemplateId,
} from '../../../domain/keychain/model/types';
import { STYLE_CATALOG } from '../../../domain/keychain/styles/style-builder';
import { TEMPLATE_CATALOG } from '../../../domain/keychain/templates/template-builder';
import {
  randomizeParams,
  randomizeWithValidation,
  type RandomSource,
  type RandomizeTransaction,
  type RandomizeValidation,
} from '../model/randomizer';
import { resetParamsForSection, type CustomizerResetSection } from '../model/reset';

export type CandidateControlGroup =
  'name' | 'template' | 'template-details' | 'style' | 'style-details' | 'refine' | 'print';

export type CandidateFeedback = {
  requestId: number;
  status: 'checking' | 'rejected';
  group: CandidateControlGroup;
  controlKey?: keyof KeychainParams;
  diagnostic?: string;
};

export type CandidateValidation = (
  params: KeychainParams,
  font: FontDefinition,
  subtitleFont: FontDefinition,
) => Promise<GeometryResult>;

export type CandidateCallbacks = {
  pending?: (params: KeychainParams, font: FontDefinition, subtitleFont: FontDefinition) => void;
  validate?: CandidateValidation;
  accept?: (
    params: KeychainParams,
    result: GeometryResult,
    font: FontDefinition,
    subtitleFont: FontDefinition,
  ) => void;
  reject?: (params: KeychainParams, font: FontDefinition, subtitleFont: FontDefinition) => void;
};

export const useCustomizerParams = (
  initialParams?: KeychainParams,
  candidateCallbacks: CandidateCallbacks = {},
): {
  params: KeychainParams;
  acceptedParams: KeychainParams;
  candidateFeedback: CandidateFeedback | undefined;
  clearCandidateFeedback: () => void;
  selectedFont: FontDefinition;
  selectedSubtitleFont: FontDefinition;
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
  updateMany: (changes: Partial<KeychainParams>, group?: CandidateControlGroup) => void;
  updateText: (text: string) => void;
  updateSubtitle: (subtitle: string) => void;
  updateSubtitleFont: (fontId: string) => void;
  applyDesign: (
    changes: Pick<Partial<KeychainParams>, 'text' | 'subtitle' | 'templateId' | 'styleId'>,
  ) => void;
  selectTemplate: (templateId: TemplateId) => void;
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
  const paramsRef = useRef(params);
  const acceptedParamsRef = useRef(params);
  const [acceptedParams, setAcceptedParams] = useState(params);
  const callbacksRef = useRef(candidateCallbacks);

  useEffect(() => {
    callbacksRef.current = candidateCallbacks;
  }, [candidateCallbacks]);
  const candidateRequestId = useRef(0);
  const validationTimer = useRef<number | undefined>(undefined);
  const [candidateFeedback, setCandidateFeedback] = useState<CandidateFeedback>();

  const previousParams = useRef<KeychainParams | undefined>(undefined);
  const [canUndo, setCanUndo] = useState(false);
  const setParamsDirect: Dispatch<SetStateAction<KeychainParams>> = (next) => {
    previousParams.current = undefined;
    setCanUndo(false);
    const candidate = typeof next === 'function' ? next(paramsRef.current) : next;

    proposeCandidate(candidate, 'template', 'templateId');
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

  useEffect(
    () => () => {
      candidateRequestId.current += 1;
      if (validationTimer.current !== undefined) window.clearTimeout(validationTimer.current);
    },
    [],
  );

  const selectedFont = useMemo(
    () =>
      [...allFonts, ...localFonts.flatMap((record) => (record.font ? [record.font] : []))].find(
        (font) => font.id === params.fontId,
      ) ?? FONT_CATALOG[0],
    [allFonts, localFonts, params.fontId],
  );
  const selectedSubtitleFont = useMemo(
    () =>
      [...allFonts, ...localFonts.flatMap((record) => (record.font ? [record.font] : []))].find(
        (font) => font.id === params.subtitleFontId,
      ) ?? FONT_CATALOG[0],
    [allFonts, localFonts, params.subtitleFontId],
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

  const commitAccepted = (
    candidate: KeychainParams,
    result?: GeometryResult,
    requestId = candidateRequestId.current,
  ): void => {
    if (requestId !== candidateRequestId.current) return;
    const normalized = normalizeParams(candidate);
    const font =
      allFonts.find((item) => item.id === normalized.fontId) ?? fontDefinition(normalized.fontId);
    const subtitleFont =
      allFonts.find((item) => item.id === normalized.subtitleFontId) ??
      fontDefinition(normalized.subtitleFontId);
    if (result) callbacksRef.current.accept?.(normalized, result, font, subtitleFont);
    paramsRef.current = normalized;
    acceptedParamsRef.current = normalized;
    setParams(normalized);
    setAcceptedParams(normalized);
    setCandidateFeedback(undefined);
  };

  const proposeCandidate = (
    candidate: KeychainParams,
    group: CandidateControlGroup,
    controlKey?: keyof KeychainParams,
  ): void => {
    let normalized: KeychainParams;
    try {
      normalized = normalizeParams(candidate);
    } catch (error) {
      const requestId = ++candidateRequestId.current;
      if (validationTimer.current !== undefined) window.clearTimeout(validationTimer.current);
      setFontNotice(undefined);
      const accepted = acceptedParamsRef.current;

      callbacksRef.current.reject?.(
        accepted,
        allFonts.find((item) => item.id === accepted.fontId) ?? fontDefinition(accepted.fontId),
        allFonts.find((item) => item.id === accepted.subtitleFontId) ??
          fontDefinition(accepted.subtitleFontId),
      );
      paramsRef.current = accepted;
      setParams(accepted);
      setCandidateFeedback({
        requestId,
        status: 'rejected',
        group,
        controlKey,
        diagnostic: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (JSON.stringify(normalized) === JSON.stringify(paramsRef.current)) return;
    const requestId = ++candidateRequestId.current;

    previousParams.current = undefined;
    setCanUndo(false);
    paramsRef.current = normalized;
    setParams(normalized);
    const font =
      allFonts.find((item) => item.id === normalized.fontId) ?? fontDefinition(normalized.fontId);
    const subtitleFont =
      allFonts.find((item) => item.id === normalized.subtitleFontId) ??
      fontDefinition(normalized.subtitleFontId);

    setCandidateFeedback({ requestId, status: 'checking', group, controlKey });
    callbacksRef.current.pending?.(normalized, font, subtitleFont);
    if (validationTimer.current !== undefined) window.clearTimeout(validationTimer.current);

    const validate = callbacksRef.current.validate;
    if (!validate) {
      callbacksRef.current.reject?.(normalized, font, subtitleFont);
      commitAccepted(normalized, undefined, requestId);
      return;
    }

    validationTimer.current = window.setTimeout(() => {
      void validate(normalized, font, subtitleFont)
        .then((result) => {
          if (requestId !== candidateRequestId.current) return;
          const accepted =
            result.printable && !result.issues.some((issue) => issue.severity === 'error');
          if (accepted) {
            commitAccepted(normalized, result, requestId);
            return;
          }
          setFontNotice(undefined);
          const acceptedParams = acceptedParamsRef.current;

          callbacksRef.current.reject?.(
            acceptedParams,
            allFonts.find((item) => item.id === acceptedParams.fontId) ??
              fontDefinition(acceptedParams.fontId),
            allFonts.find((item) => item.id === acceptedParams.subtitleFontId) ??
              fontDefinition(acceptedParams.subtitleFontId),
          );
          paramsRef.current = acceptedParamsRef.current;
          setParams(acceptedParamsRef.current);
          setCandidateFeedback({
            requestId,
            status: 'rejected',
            group,
            controlKey,
            diagnostic:
              result.issues.find((issue) => issue.severity === 'error')?.code ?? 'not-printable',
          });
        })
        .catch((error: unknown) => {
          if (requestId !== candidateRequestId.current) return;
          setFontNotice(undefined);
          const acceptedParams = acceptedParamsRef.current;

          callbacksRef.current.reject?.(
            acceptedParams,
            allFonts.find((item) => item.id === acceptedParams.fontId) ??
              fontDefinition(acceptedParams.fontId),
            allFonts.find((item) => item.id === acceptedParams.subtitleFontId) ??
              fontDefinition(acceptedParams.subtitleFontId),
          );
          paramsRef.current = acceptedParamsRef.current;
          setParams(acceptedParamsRef.current);
          setCandidateFeedback({
            requestId,
            status: 'rejected',
            group,
            controlKey,
            diagnostic: error instanceof Error ? error.message : String(error),
          });
        });
    }, 120);
  };

  const groupForKey = (
    key: keyof KeychainParams,
    current: KeychainParams,
  ): CandidateControlGroup => {
    if (key === 'text' || key === 'subtitle') return 'name';
    if (key === 'templateId') return 'template';
    if (key === 'styleId') return 'style';
    if (key in PARAMETER_REGISTRY)
      return parameterPresentationGroup(current, key as ShapeParameter);
    if (
      key === 'magnetPocketPreset' ||
      key === 'magnetPocketPlacement' ||
      key === 'plantAccentEnabled'
    )
      return 'template-details';
    if (key === 'heartInteriorMode') return 'style-details';
    if (
      key === 'edgeFinish' ||
      key === 'topEdgeMm' ||
      key === 'bottomEdgeMm' ||
      key === 'textEdgeMm' ||
      key === 'minimumWallMm' ||
      key === 'bottomClearanceMm' ||
      key === 'subtitleReliefDepthMm'
    )
      return 'print';
    return 'refine';
  };

  const update = <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;

    proposeCandidate({ ...current, [key]: value }, groupForKey(key, current), key);
  };

  const updateMany = (changes: Partial<KeychainParams>, group?: CandidateControlGroup): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;
    const keys = Object.keys(changes) as (keyof KeychainParams)[];

    proposeCandidate(
      { ...current, ...changes },
      group ?? groupForKey(keys[0] ?? 'edgeFinish', current),
      keys[0],
    );
  };

  const updateText = (text: string): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;
    const currentFont =
      allFonts.find((font) => font.id === current.fontId) ?? fontDefinition(current.fontId);
    const articulated = current.templateId === 'articulated-name';
    const textForCompatibility = text;
    const compatible = articulated
      ? fontSupportsArticulatedName(currentFont, text)
      : fontSupportsText(currentFont, textForCompatibility);
    const replacement = compatible
      ? undefined
      : articulated
        ? articulatedFallbackFont(text)
        : allFonts.find((font) => fontSupportsText(font, textForCompatibility));
    if (replacement)
      setFontNotice({ font: currentFont.name, replacement: replacement.name, articulated });
    proposeCandidate(
      {
        ...current,
        text,
        fontId: replacement?.id ?? current.fontId,
      },
      'name',
      'text',
    );
  };
  const updateSubtitle = (subtitle: string): void => {
    setFontNotice(undefined);
    const currentFont =
      allFonts.find((font) => font.id === paramsRef.current.subtitleFontId) ??
      fontDefinition(paramsRef.current.subtitleFontId);
    const current = paramsRef.current;
    const replacement =
      !subtitle || fontSupportsText(currentFont, subtitle)
        ? undefined
        : allFonts.find((font) => fontSupportsText(font, subtitle));
    if (replacement)
      setFontNotice({
        font: currentFont.name,
        replacement: replacement.name,
        articulated: false,
        target: 'subtitle',
      });
    proposeCandidate(
      {
        ...current,
        subtitle,
        subtitleFontId: replacement?.id ?? current.subtitleFontId,
      },
      'name',
      'subtitle',
    );
  };
  const updateSubtitleFont = (fontId: string): void => {
    setFontNotice(undefined);
    const selected = allFonts.find((font) => font.id === fontId) ?? fontDefinition(fontId);
    const current = paramsRef.current;
    if (current.subtitle && !fontSupportsText(selected, current.subtitle)) {
      const replacement = allFonts.find((font) => fontSupportsText(font, current.subtitle));
      if (replacement) {
        setFontNotice({
          font: selected.name,
          replacement: replacement.name,
          articulated: false,
          target: 'subtitle',
        });
        proposeCandidate(
          { ...current, subtitleFontId: replacement.id },
          'refine',
          'subtitleFontId',
        );
        return;
      }
    }
    proposeCandidate({ ...current, subtitleFontId: fontId }, 'refine', 'subtitleFontId');
  };

  const applyDesign = (
    changes: Pick<Partial<KeychainParams>, 'text' | 'subtitle' | 'templateId' | 'styleId'>,
  ): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;
    {
      const templateId = changes.templateId ?? current.templateId;
      const template =
        TEMPLATE_CATALOG.find((item) => item.id === templateId) ?? TEMPLATE_CATALOG[0];
      const currentFont =
        allFonts.find((font) => font.id === current.fontId) ?? fontDefinition(current.fontId);
      const text = changes.text ?? current.text;
      const replacement =
        templateId === 'articulated-name' && !fontSupportsArticulatedName(currentFont, text)
          ? articulatedFallbackFont(text)
          : !fontSupportsText(currentFont, text)
            ? allFonts.find((font) => fontSupportsText(font, text))
            : undefined;

      const requestedStyle = changes.styleId ?? current.styleId;
      const styleId =
        templateId === 'magnet'
          ? 'plain'
          : template.styles.includes(requestedStyle)
            ? requestedStyle
            : 'contour';
      const next = {
        ...current,
        ...changes,
        templateId,
        styleId,
        text,
        subtitle: templateId === 'articulated-name' ? '' : (changes.subtitle ?? current.subtitle),
        fontId: replacement?.id ?? current.fontId,
      };

      const controlKey = changes.templateId
        ? 'templateId'
        : changes.styleId
          ? 'styleId'
          : changes.text
            ? 'text'
            : 'subtitle';

      proposeCandidate(normalizeParams(next), groupForKey(controlKey, current), controlKey);
    }
  };

  const selectTemplate = (templateId: TemplateId): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;
    const selected =
      allFonts.find((font) => font.id === current.fontId) ?? fontDefinition(current.fontId);
    const previewReplacement =
      templateId === 'articulated-name' && !fontSupportsArticulatedName(selected, params.text)
        ? articulatedFallbackFont(current.text)
        : undefined;
    if (previewReplacement)
      setFontNotice({
        font: selected.name,
        replacement: previewReplacement.name,
        articulated: true,
      });
    {
      const currentFont =
        allFonts.find((font) => font.id === current.fontId) ?? fontDefinition(current.fontId);
      const replacement =
        templateId === 'articulated-name' && !fontSupportsArticulatedName(currentFont, current.text)
          ? articulatedFallbackFont(current.text)
          : undefined;
      const currentSubtitleFont =
        allFonts.find((font) => font.id === current.subtitleFontId) ??
        fontDefinition(current.subtitleFontId);
      const subtitleReplacement =
        templateId !== 'articulated-name' &&
        current.subtitle &&
        !fontSupportsText(currentSubtitleFont, current.subtitle)
          ? allFonts.find((font) => fontSupportsText(font, current.subtitle))
          : undefined;

      const template =
        TEMPLATE_CATALOG.find((item) => item.id === templateId) ?? TEMPLATE_CATALOG[0];

      const next = {
        ...current,
        templateId,
        styleId:
          templateId === 'magnet'
            ? 'plain'
            : template.styles.includes(current.styleId)
              ? current.styleId
              : 'contour',
        fontId: replacement?.id ?? current.fontId,
        subtitleFontId:
          templateId === 'articulated-name'
            ? DEFAULT_PARAMS.subtitleFontId
            : (subtitleReplacement?.id ?? current.subtitleFontId),
        ...(templateId === 'articulated-name'
          ? {
              subtitle: '',
              subtitleFontId: DEFAULT_PARAMS.subtitleFontId,
              subtitleOffsetXRatio: 0,
              subtitleOffsetYRatio: 0,
            }
          : {}),
        baseThicknessMm:
          templateId === 'magnet'
            ? Math.max(4.4, Math.min(5, current.baseThicknessMm))
            : templateId === 'articulated-name'
              ? Math.max(3.4, Math.min(4, current.baseThicknessMm))
              : Math.min(4, current.baseThicknessMm),
      };

      proposeCandidate(normalizeParams(next), 'template', 'templateId');
    }
  };

  const resetSection = (section: CustomizerResetSection): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;

    proposeCandidate(
      resetParamsForSection(current, section),
      section === 'style'
        ? 'style-details'
        : section === 'template'
          ? 'template'
          : section === 'name' || section === 'subtitle'
            ? 'name'
            : section === 'font'
              ? 'refine'
              : 'refine',
      section === 'style'
        ? 'styleId'
        : section === 'template'
          ? 'templateId'
          : section === 'name'
            ? 'text'
            : section === 'subtitle'
              ? 'subtitle'
              : section === 'font'
                ? 'fontId'
                : undefined,
    );
  };

  const reset = (): void => {
    setFontNotice(undefined);
    proposeCandidate({ ...DEFAULT_PARAMS }, 'template', 'templateId');
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
    const current = paramsRef.current;
    if (current.fontId === id || current.subtitleFontId === id)
      setParamsDirect((current) => ({
        ...current,
        ...(current.fontId === id ? { fontId: FONT_CATALOG[0].id } : {}),
        ...(current.subtitleFontId === id ? { subtitleFontId: FONT_CATALOG[0].id } : {}),
      }));
    setLocalFonts((current) => current.filter((item) => item.id !== id));
  };

  return {
    params,
    acceptedParams,
    candidateFeedback,
    clearCandidateFeedback: () => {
      setCandidateFeedback(undefined);
    },
    selectedFont,
    selectedSubtitleFont,
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
    updateMany,
    updateText,
    updateSubtitle,
    updateSubtitleFont,
    applyDesign,
    selectTemplate,
    resetSection,
    reset,
    showsParameter: (parameter) => hasActiveParameter(params, parameter),
    rangeFor: (parameter) => parameterRange(params, parameter),
    setParams: setParamsDirect,
    randomize: async (random, validate) => {
      const original = acceptedParamsRef.current;
      const requestId = ++candidateRequestId.current;
      if (validationTimer.current !== undefined) window.clearTimeout(validationTimer.current);
      const font =
        allFonts.find((item) => item.id === original.fontId) ?? fontDefinition(original.fontId);
      const subtitleFont =
        allFonts.find((item) => item.id === original.subtitleFontId) ??
        fontDefinition(original.subtitleFontId);

      callbacksRef.current.reject?.(original, font, subtitleFont);
      paramsRef.current = original;
      setParams(original);
      setCandidateFeedback({ requestId, status: 'checking', group: 'refine' });
      previousParams.current = undefined;
      setCanUndo(false);
      const transaction = validate
        ? await randomizeWithValidation(original, validate, { random, fonts: allFonts })
        : {
            status: 'accepted' as const,
            params: randomizeParams(original, { random, fonts: allFonts }),
            attempts: 1,
          };
      if (requestId !== candidateRequestId.current) {
        return {
          status: 'cancelled' as const,
          params: paramsRef.current,
          attempts: transaction.attempts,
        };
      }
      if (transaction.status === 'accepted') {
        previousParams.current = original;
        setCanUndo(true);
        const normalized = normalizeParams(transaction.params);
        const font =
          allFonts.find((item) => item.id === normalized.fontId) ??
          fontDefinition(normalized.fontId);
        const subtitleFont =
          allFonts.find((item) => item.id === normalized.subtitleFontId) ??
          fontDefinition(normalized.subtitleFontId);
        if (transaction.result)
          callbacksRef.current.accept?.(normalized, transaction.result, font, subtitleFont);
        paramsRef.current = normalized;
        acceptedParamsRef.current = normalized;
        setAcceptedParams(normalized);
        setParams(normalized);
        setCandidateFeedback(undefined);
      } else {
        paramsRef.current = original;
        setParams(original);
        setCandidateFeedback({
          requestId,
          status: 'rejected',
          group: 'refine',
          diagnostic: 'randomize-failed',
        });
      }
      return transaction;
    },
    undo: () => {
      const previous = previousParams.current;
      if (!previous) return;
      previousParams.current = undefined;
      setCanUndo(false);
      proposeCandidate(previous, 'refine');
    },
    canUndo,
  };
};
