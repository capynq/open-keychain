import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { failureFrom } from '@/shared/lib/recovery/failure';

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
import {
  createGoogleFontProvider,
  GoogleFontProviderError,
} from '../../../domain/keychain/fonts/google-provider';
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
  reconcileCandidateParams,
  type KeychainParams,
  type TemplateId,
} from '../../../domain/keychain/model/types';
import { STYLE_CATALOG } from '../../../domain/keychain/styles/style-builder';
import { TEMPLATE_CATALOG } from '../../../domain/keychain/templates/template-builder';
import { CandidateScheduler, type CandidateIntent } from '../model/candidate-scheduler';
import { reconcileGeometryParameterLimits } from '../model/geometry-parameter-limits';
import {
  randomizeParams,
  randomizeWithValidation,
  type RandomSource,
  type RandomizeTransaction,
  type RandomizeValidation,
} from '../model/randomizer';
import {
  recoveryRecipes,
  recoveryFontSignature,
  type RecoveryOption,
} from '../model/recovery-recipes';
import { resetParamsForSection, type CustomizerResetSection } from '../model/reset';

export type CandidateControlGroup =
  'name' | 'template' | 'template-details' | 'style' | 'style-details' | 'refine' | 'print';

export type CandidateFeedback = {
  requestId: number;
  status: 'checking' | 'rejected';
  group: CandidateControlGroup;
  controlKey?: keyof KeychainParams;
  diagnostic?: string;
  failure?: RecoveryFailure;
};

export type CandidateValidation = (
  params: KeychainParams,
  font: FontDefinition,
  subtitleFont: FontDefinition,
) => Promise<GeometryResult>;

export type CandidateCallbacks = {
  pending?: (params: KeychainParams, font: FontDefinition, subtitleFont: FontDefinition) => void;
  validate?: CandidateValidation;
  validateRecovery?: CandidateValidation;
  cancelRecovery?: () => void;
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
  recoveryOptions: RecoveryOption[];
  recoveryChecking: boolean;
  prepareRecovery: (requestId: number) => Promise<void>;
  cancelRecovery: () => void;
  applyRecovery: (requestId: number, optionId: string) => boolean;
  undoKind: 'randomize' | 'recovery' | undefined;
  selectedFont: FontDefinition;
  selectedSubtitleFont: FontDefinition;
  fontForId: (id: string) => FontDefinition;
  googleFonts: FontDefinition[];
  googleLoading: boolean;
  googleError: string | undefined;
  googleFailure: RecoveryFailure | undefined;
  googleFontsConfigured: boolean;
  loadGoogleFonts: () => Promise<FontDefinition[] | undefined>;
  localFonts: LocalFontRecord[];
  localFontFailure: RecoveryFailure | undefined;
  clearLocalFontFailure: () => void;
  importLocalFonts: (files: FileList | File[]) => Promise<void>;
  pickLocalFonts: () => Promise<void>;
  reconnectLocalFont: (id: string) => Promise<void>;
  removeLocalFont: (id: string) => Promise<void>;
  activeTemplate: (typeof TEMPLATE_CATALOG)[number];
  availableStyles: typeof STYLE_CATALOG;
  usesCyrillic: boolean;
  fontNotice: FontNotice | undefined;
  update: <K extends keyof KeychainParams>(
    key: K,
    value: KeychainParams[K],
    intent?: CandidateIntent,
  ) => void;
  updateMany: (
    changes: Partial<KeychainParams>,
    group?: CandidateControlGroup,
    intent?: CandidateIntent,
  ) => void;
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
  const [candidateScheduler] = useState(() => new CandidateScheduler());
  const [candidateFeedback, setCandidateFeedback] = useState<CandidateFeedback>();

  const previousParams = useRef<KeychainParams | undefined>(undefined);
  const [canUndo, setCanUndo] = useState(false);
  const [undoKind, setUndoKind] = useState<'randomize' | 'recovery'>();
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOption[]>([]);
  const [recoveryChecking, setRecoveryChecking] = useState(false);
  const recoveryEpoch = useRef(0);
  type RejectedAttempt = {
    requestId: number;
    params: KeychainParams;
    acceptedSignature: string;
    font: FontDefinition;
    subtitleFont: FontDefinition;
    failure: RecoveryFailure;
    group: CandidateControlGroup;
    controlKey?: keyof KeychainParams;
  };
  const rejectedAttempt = useRef<RejectedAttempt | undefined>(undefined);
  const recoveryResults = useRef(
    new Map<
      string,
      {
        params: KeychainParams;
        result: GeometryResult;
        font: FontDefinition;
        subtitleFont: FontDefinition;
        fontSignature: string;
        subtitleSignature: string;
      }
    >(),
  );
  const cancelRecovery = (): void => {
    callbacksRef.current.cancelRecovery?.();
    recoveryEpoch.current += 1;
    recoveryResults.current.clear();
    setRecoveryOptions([]);
    setRecoveryChecking(false);
  };
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
  const [googleFailure, setGoogleFailure] = useState<RecoveryFailure>();
  const [localFonts, setLocalFonts] = useState<LocalFontRecord[]>([]);
  const [localFontFailure, setLocalFontFailure] = useState<RecoveryFailure>();
  const [localStore] = useState(() => createLocalFontStore({ onFailure: setLocalFontFailure }));
  const [provider] = useState(() =>
    createGoogleFontProvider({
      apiKey: import.meta.env.VITE_GOOGLE_FONTS_API_KEY,
    }),
  );
  const googleRequestRef = useRef<Promise<FontDefinition[] | undefined> | undefined>(undefined);
  const loadGoogleFonts = (): Promise<FontDefinition[] | undefined> => {
    if (googleRequestRef.current) return googleRequestRef.current;
    setGoogleLoading(true);
    setGoogleError(undefined);
    setGoogleFailure(undefined);
    const request = (async () => {
      try {
        const fonts = await provider.list();

        setGoogleFonts(fonts);
        return fonts;
      } catch (error) {
        setGoogleFailure(
          error instanceof GoogleFontProviderError
            ? { code: `google-font-${error.code}`, message: error.message }
            : failureFrom(error, 'font-load'),
        );
        setGoogleError(error instanceof Error ? error.message : 'Google Fonts are unavailable.');
        return undefined;
      } finally {
        setGoogleLoading(false);
      }
    })();

    googleRequestRef.current = request;
    void request
      .finally(() => {
        if (googleRequestRef.current === request) googleRequestRef.current = undefined;
      })
      .catch(() => undefined);
    return request;
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
      recoveryEpoch.current += 1;
      callbacksRef.current.cancelRecovery?.();
      candidateScheduler.cancel();
    },
    [candidateScheduler],
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
    if (result)
      callbacksRef.current.accept?.(
        normalized,
        { ...result, timings: { ...result.timings, candidateAcceptedAt: performance.now() } },
        font,
        subtitleFont,
      );
    paramsRef.current = normalized;
    acceptedParamsRef.current = normalized;
    setParams(normalized);
    setAcceptedParams(normalized);
    setCandidateFeedback(undefined);
  };

  const recordRejectedAttempt = (
    requestId: number,
    candidate: KeychainParams,
    group: CandidateControlGroup,
    controlKey: keyof KeychainParams | undefined,
    failure: RecoveryFailure,
  ): void => {
    rejectedAttempt.current = {
      requestId,
      params: candidate,
      acceptedSignature: JSON.stringify(acceptedParamsRef.current),
      font:
        allFonts.find((item) => item.id === candidate.fontId) ?? fontDefinition(candidate.fontId),
      subtitleFont:
        allFonts.find((item) => item.id === candidate.subtitleFontId) ??
        fontDefinition(candidate.subtitleFontId),
      failure,
      group,
      controlKey,
    };
    setCandidateFeedback({
      requestId,
      status: 'rejected',
      group,
      controlKey,
      failure,
      diagnostic: failure.message ?? failure.code,
    });
  };

  const prepareRecovery = async (requestId: number): Promise<void> => {
    const attempt = rejectedAttempt.current;
    if (!attempt || attempt.requestId !== requestId || candidateRequestId.current !== requestId)
      return;
    cancelRecovery();
    const epoch = recoveryEpoch.current;
    const recipes = recoveryRecipes(
      attempt.params,
      attempt.failure,
      attempt.controlKey === 'subtitleFontId' ? attempt.subtitleFont : attempt.font,
      attempt.controlKey,
    );

    setRecoveryOptions(
      recipes.map(({ id, labelKey, values }) => ({ id, labelKey, values, status: 'checking' })),
    );
    const validate = callbacksRef.current.validateRecovery;
    if (!validate) {
      setRecoveryOptions(
        recipes.map(({ id, labelKey, values }) => ({
          id,
          labelKey,
          values,
          status: 'unavailable',
        })),
      );
      return;
    }
    setRecoveryChecking(true);
    for (const recipe of recipes) {
      if (epoch !== recoveryEpoch.current || requestId !== candidateRequestId.current) return;
      let ready = false;
      try {
        let params = normalizeParams(recipe.params);
        const font =
          allFonts.find((item) => item.id === params.fontId) ?? fontDefinition(params.fontId);
        const subtitleFont =
          allFonts.find((item) => item.id === params.subtitleFontId) ??
          fontDefinition(params.subtitleFontId);
        let result = await validate(params, font, subtitleFont);
        const corrected = reconcileGeometryParameterLimits(params, result.parameterLimits);
        if (corrected !== params) {
          params = normalizeParams(corrected);
          if (epoch !== recoveryEpoch.current) return;
          result = await validate(params, font, subtitleFont);
        }
        if (epoch !== recoveryEpoch.current || requestId !== candidateRequestId.current) return;
        ready = result.printable && !result.issues.some((issue) => issue.severity === 'error');
        if (ready)
          recoveryResults.current.set(recipe.id, {
            params,
            result,
            font,
            subtitleFont,
            fontSignature: recoveryFontSignature(font),
            subtitleSignature: recoveryFontSignature(subtitleFont),
          });
      } catch {
        // A failed proposal never replaces the accepted preview or its actionable failure.
      }
      if (epoch !== recoveryEpoch.current || requestId !== candidateRequestId.current) return;
      setRecoveryOptions((options) =>
        options.map((option) =>
          option.id === recipe.id ? { ...option, status: ready ? 'ready' : 'unavailable' } : option,
        ),
      );
    }
    if (epoch === recoveryEpoch.current) setRecoveryChecking(false);
  };

  const applyRecovery = (requestId: number, optionId: string): boolean => {
    const attempt = rejectedAttempt.current;
    const prepared = recoveryResults.current.get(optionId);
    if (
      !attempt ||
      !prepared ||
      requestId !== candidateRequestId.current ||
      attempt.requestId !== requestId ||
      attempt.acceptedSignature !== JSON.stringify(acceptedParamsRef.current)
    )
      return false;
    const currentFont =
      allFonts.find((font) => font.id === prepared.params.fontId) ??
      fontDefinition(prepared.params.fontId);
    const currentSubtitle =
      allFonts.find((font) => font.id === prepared.params.subtitleFontId) ??
      fontDefinition(prepared.params.subtitleFontId);
    if (
      recoveryFontSignature(currentFont) !== prepared.fontSignature ||
      currentFont.data !== prepared.font.data ||
      recoveryFontSignature(currentSubtitle) !== prepared.subtitleSignature ||
      currentSubtitle.data !== prepared.subtitleFont.data
    )
      return false;
    const previous = acceptedParamsRef.current;
    const nextId = ++candidateRequestId.current;

    candidateScheduler.cancel();
    cancelRecovery();
    callbacksRef.current.pending?.(prepared.params, prepared.font, prepared.subtitleFont);
    commitAccepted(prepared.params, prepared.result, nextId);
    previousParams.current = previous;
    setUndoKind('recovery');
    setCanUndo(true);
    rejectedAttempt.current = undefined;
    return true;
  };

  const proposeCandidate = (
    candidate: KeychainParams,
    group: CandidateControlGroup,
    controlKey?: keyof KeychainParams,
    intent: CandidateIntent = 'immediate',
  ): void => {
    const inputAt = performance.now();
    let normalized: KeychainParams;
    try {
      normalized = normalizeParams(reconcileCandidateParams(acceptedParamsRef.current, candidate));
    } catch (error) {
      const requestId = ++candidateRequestId.current;

      candidateScheduler.cancel();
      cancelRecovery();
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
      recordRejectedAttempt(
        requestId,
        candidate,
        group,
        controlKey,
        failureFrom(error, 'geometry-build-failed'),
      );
      return;
    }
    if (JSON.stringify(normalized) === JSON.stringify(paramsRef.current)) return;
    const requestId = ++candidateRequestId.current;

    cancelRecovery();
    rejectedAttempt.current = undefined;

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
    candidateScheduler.cancel();

    const validate = callbacksRef.current.validate;
    if (!validate) {
      callbacksRef.current.reject?.(normalized, font, subtitleFont);
      commitAccepted(normalized, undefined, requestId);
      return;
    }

    candidateScheduler.schedule(intent, () => {
      const dispatchedAt = performance.now();

      void validate(normalized, font, subtitleFont)
        .then(async (result) => {
          if (requestId !== candidateRequestId.current) return;
          // Revalidate the actual applied values when new text changes geometry-dependent limits.
          const corrected = reconcileGeometryParameterLimits(normalized, result.parameterLimits);
          if (corrected !== normalized) {
            normalized = normalizeParams(corrected);
            result = await validate(normalized, font, subtitleFont);
            if (requestId !== candidateRequestId.current) return;
          }
          const accepted =
            result.printable && !result.issues.some((issue) => issue.severity === 'error');
          if (accepted) {
            result = {
              ...result,
              timings: {
                ...result.timings,
                candidateInputAt: inputAt,
                candidateDispatchedAt: dispatchedAt,
                candidateValidatedAt: performance.now(),
              },
            };
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
          const issue = result.issues.find((item) => item.severity === 'error');

          recordRejectedAttempt(
            requestId,
            normalized,
            group,
            controlKey,
            issue?.failure ?? {
              code: issue?.code ?? 'geometry-build-failed',
              message: issue?.message,
            },
          );
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
          recordRejectedAttempt(
            requestId,
            normalized,
            group,
            controlKey,
            failureFrom(error, 'geometry-build-failed'),
          );
        });
    });
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
      key === 'textEdgeMm' ||
      key === 'textEdgeFinish' ||
      key === 'edgeFinish' ||
      key === 'topEdgeMm' ||
      key === 'bottomEdgeMm' ||
      key === 'minimumWallMm' ||
      key === 'bottomClearanceMm' ||
      key === 'subtitleReliefDepthMm'
    )
      return 'print';
    return 'refine';
  };

  const update = <K extends keyof KeychainParams>(
    key: K,
    value: KeychainParams[K],
    intent: CandidateIntent = 'immediate',
  ): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;

    proposeCandidate({ ...current, [key]: value }, groupForKey(key, current), key, intent);
  };

  const updateMany = (
    changes: Partial<KeychainParams>,
    group?: CandidateControlGroup,
    intent: CandidateIntent = 'immediate',
  ): void => {
    setFontNotice(undefined);
    const current = paramsRef.current;
    const keys = Object.keys(changes) as (keyof KeychainParams)[];

    proposeCandidate(
      { ...current, ...changes },
      group ?? groupForKey(keys[0] ?? 'textEdgeFinish', current),
      keys[0],
      intent,
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
      'text',
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
    setLocalFontFailure(undefined);
    const imported = await localStore.importFiles(files);
    if (imported.length)
      setLocalFonts((current) => [
        ...current,
        ...imported.filter((record) => !current.some((existing) => existing.id === record.id)),
      ]);
  };
  const pickLocalFonts = async (): Promise<void> => {
    setLocalFontFailure(undefined);
    const imported = await localStore.pick();
    if (imported.length)
      setLocalFonts((current) => [
        ...current,
        ...imported.filter((record) => !current.some((existing) => existing.id === record.id)),
      ]);
  };
  const reconnectLocalFont = async (id: string): Promise<void> => {
    setLocalFontFailure(undefined);
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
    recoveryOptions,
    recoveryChecking,
    prepareRecovery,
    cancelRecovery,
    applyRecovery,
    undoKind,
    clearCandidateFeedback: () => {
      cancelRecovery();
      rejectedAttempt.current = undefined;
      setCandidateFeedback(undefined);
    },
    selectedFont,
    selectedSubtitleFont,
    fontForId: (id) => allFonts.find((font) => font.id === id) ?? fontDefinition(id),
    googleFonts,
    googleLoading,
    googleError,
    googleFailure,
    googleFontsConfigured: Boolean(import.meta.env.VITE_GOOGLE_FONTS_API_KEY?.trim()),
    loadGoogleFonts,
    localFonts,
    localFontFailure,
    clearLocalFontFailure: () => setLocalFontFailure(undefined),
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
      cancelRecovery();
      rejectedAttempt.current = undefined;
      const original = acceptedParamsRef.current;
      const requestId = ++candidateRequestId.current;

      candidateScheduler.cancel();
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
        setUndoKind('randomize');
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
