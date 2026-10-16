import { useEffect, useMemo, useRef, useState } from 'react';

import type { FontCategory } from '@/domain/keychain/fonts/catalog';
import type { FontTarget } from '@/features/customizer/model/font-browser';

import { keyringPresetValues } from '@/domain/keychain/model/keyring-presets';
import {
  PARAMETER_REGISTRY,
  parameterPresentationGroup,
  parametersForPresentationGroup,
  type ShapeParameter,
} from '@/domain/keychain/model/parameters';
import {
  MAGNET_POCKET_PRESETS,
  type HeartInteriorMode,
  type KeychainParams,
  type PrintAppearanceOverrides,
  type GeometryResult,
} from '@/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';
import {
  type CandidateControlGroup,
  type useCustomizerParams,
} from '@/features/customizer/hooks/useCustomizerParams';
import { useEditorMode } from '@/features/customizer/hooks/useEditorMode';
import { useFontChooser } from '@/features/customizer/hooks/useFontChooser';
import { useFontSuggestions } from '@/features/customizer/hooks/useFontSuggestions';
import { useProNavigation } from '@/features/customizer/hooks/useProNavigation';
import {
  styleDescription,
  styleName,
  templateDescription,
  templateName,
  t,
  type Locale,
} from '@/infrastructure/i18n';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';
import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import { stylePreviewAsset, TEMPLATE_PREVIEW_ASSETS } from '../design-card-assets';
import { DesignCardRail } from '../DesignCardRail/DesignCardRail';
import { DesignSelectCard } from '../DesignSelectCard/DesignSelectCard';
import { KeyringPositionPicker } from '../KeyringPositionPicker/KeyringPositionPicker';
import { KeyringPresetPicker } from '../KeyringPresetPicker/KeyringPresetPicker';
import { RangeControl } from '../RangeControl/RangeControl';
import { AppearanceControls } from './AppearanceControls';
import styles from './ControlsPanel.module.css';
import { EditorModeSwitch } from './EditorModeSwitch';
import { FontBrowser } from './FontBrowser';
import { FontChooserDialog } from './FontChooserDialog';
import { GeometryFinishControls } from './GeometryFinishControls';
import { ParameterGroupList } from './ParameterGroupList';
import { SimpleAdjustments } from './SimpleAdjustments';
import { SimpleFontPicker } from './SimpleFontPicker';
import { useControlsScrollState } from './useControlsScrollState';

const EMPTY_FAVORITE_CATEGORIES: FontCategory[] = [];

export const ControlsPanel = ({
  locale,
  customizer,
  onReset,
  bootFrame = false,
  neutralSelection = false,
  favoriteFontCategories = EMPTY_FAVORITE_CATEGORIES,
  appearanceOverrides = { version: 1 },
  onAppearanceChange,
  baseColor = '#B84838',
  reliefColor = '#FAF4E9',
  baseFinishLimits,
  textFinishLimits,
  parameterLimits,
}: {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  onReset: () => void;
  bootFrame?: boolean;
  neutralSelection?: boolean;
  favoriteFontCategories?: FontCategory[];
  appearanceOverrides?: PrintAppearanceOverrides;
  onAppearanceChange?: (overrides: PrintAppearanceOverrides) => void;
  baseColor?: string;
  reliefColor?: string;
  parameterLimits?: GeometryResult['parameterLimits'];
  baseFinishLimits?: GeometryResult['baseFinishLimits'];
  textFinishLimits?: GeometryResult['textFinishLimits'];
}) => {
  const { track } = useAnalytics();
  const { mode, changeMode } = useEditorMode();
  const {
    params,
    candidateFeedback,
    clearCandidateFeedback,
    selectedFont,
    selectedSubtitleFont,
    availableStyles,
    fontNotice,
    update,
    updateMany,
    updateText,
    updateSubtitle,
    updateSubtitleFont,
    selectTemplate,
    resetSection,
    showsParameter,
    rangeFor,
  } = customizer;
  const [fontTarget, setFontTarget] = useState<FontTarget>('primary');
  const customOpeningTransitionTracked = useRef(false);
  const { controlsRef, scrollState } = useControlsScrollState();
  const openPro = useProNavigation(mode, changeMode, controlsRef);
  const hasSubtitle =
    params.styleId !== 'heart-split' &&
    TEMPLATE_CATALOG.find((template) => template.id === params.templateId)?.supportsSubtitle ===
      true;
  const supportsKeyring =
    TEMPLATE_CATALOG.find((template) => template.id === params.templateId)?.supportsKeyring ??
    false;
  const isHeartSplit = params.styleId === 'heart-split';
  const hasSubtitleText = params.subtitle.trim().length > 0;
  const activeFontTarget: FontTarget = hasSubtitle && hasSubtitleText ? fontTarget : 'primary';
  const localSuggestionFonts = useMemo(
    () => customizer.localFonts.flatMap((record) => (record.font ? [record.font] : [])),
    [customizer.localFonts],
  );
  const fontSuggestions = useFontSuggestions(params, activeFontTarget, favoriteFontCategories, {
    googleFonts: customizer.googleFonts,
    googleAvailable: customizer.googleFontsConfigured && !customizer.googleError,
    localFonts: localSuggestionFonts,
    loadGoogleFonts: customizer.loadGoogleFonts,
  });
  const fontChooser = useFontChooser(customizer);

  useEffect(() => {
    if ((params.keyringPreset ?? 'custom') !== 'custom') {
      customOpeningTransitionTracked.current = false;
    }
  }, [params.keyringPreset]);

  const renderFontTargetSwitch = (idPrefix: string) =>
    hasSubtitle && hasSubtitleText ? (
      <div
        className="font-target-switch"
        data-testid={`${idPrefix}-switch`}
        role="radiogroup"
        aria-orientation="horizontal"
        aria-label={t(locale, 'fontTarget')}
      >
        {(['primary', 'secondary'] as const).map((target, index) => (
          <button
            key={target}
            type="button"
            role="radio"
            id={`${idPrefix}-${target}`}
            data-font-target={target}
            aria-checked={activeFontTarget === target}
            tabIndex={activeFontTarget === target ? 0 : -1}
            className={activeFontTarget === target ? 'active' : ''}
            onClick={() => setFontTarget(target)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const nextIndex =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 1
                    : (index + (event.key === 'ArrowLeft' ? -1 : 1) + 2) % 2;
              const nextTarget = (['primary', 'secondary'] as const)[nextIndex];
              setFontTarget(nextTarget);
              document.getElementById(`${idPrefix}-${nextTarget}`)?.focus();
            }}
          >
            {t(locale, target === 'primary' ? 'fontPrimary' : 'fontSecondary')}
          </button>
        ))}
      </div>
    ) : null;
  const resetActiveFont = (): void => {
    if (activeFontTarget === 'secondary') {
      setFontTarget('primary');
      resetSection('subtitle');
    } else resetSection('font');
  };
  const resetActiveFontLabel =
    activeFontTarget === 'secondary' ? t(locale, 'resetSubtitle') : t(locale, 'resetFont');

  const parameterLabel = (parameter: ShapeParameter): string => {
    if (parameter === 'baseThicknessMm')
      return t(locale, params.templateId === 'nameplate' ? 'plateThickness' : 'baseThickness');
    if (parameter === 'reliefDepthMm')
      return t(locale, params.templateId === 'nameplate' ? 'textLift' : 'raisedText');
    if (parameter === 'edgeInsetMm') return t(locale, 'edgeInset');
    if (parameter === 'holeDiameterMm' && params.keyringOpeningShape === 'slot')
      return t(locale, 'keyringSlotWidth');
    return t(locale, PARAMETER_REGISTRY[parameter].labelKey);
  };

  const adjustmentCandidateKeys = new Set<string>([
    ...Object.keys(PARAMETER_REGISTRY),
    'subtitleTextSizeMm',
    'subtitleFontWeightMm',
    'subtitleLetterSpacingMm',
    'subtitleGapMm',
    'subtitleOffsetXRatio',
    'subtitleOffsetYRatio',
    'subtitleReliefDepthMm',
    'textEdgeMm',
    'textEdgeFinish',
    'edgeFinish',
    'topEdgeMm',
    'bottomEdgeMm',
    'plantAccentEnabled',
  ]);
  const adjustmentSubcategoryForKey = (
    key: keyof KeychainParams | undefined,
  ): 'typography' | 'shape' | 'template-details' | 'style-details' | 'print' | undefined => {
    if (!key) return undefined;
    if (
      [
        'textSizeMm',
        'fontWeightMm',
        'letterSpacingMm',
        'subtitleTextSizeMm',
        'subtitleFontWeightMm',
        'subtitleLetterSpacingMm',
        'subtitleGapMm',
        'subtitleOffsetXRatio',
        'subtitleOffsetYRatio',
      ].includes(key)
    )
      return 'typography';
    if (key in PARAMETER_REGISTRY) {
      const presentation = parameterPresentationGroup(params, key as ShapeParameter);
      return presentation === 'refine' ? 'shape' : presentation;
    }
    if (
      [
        'subtitleReliefDepthMm',
        'textEdgeMm',
        'textEdgeFinish',
        'edgeFinish',
        'topEdgeMm',
        'bottomEdgeMm',
      ].includes(key)
    )
      return 'print';
    if (key === 'plantAccentEnabled') return 'template-details';
    return undefined;
  };
  const finishFeedbackTarget = ['edgeFinish', 'topEdgeMm', 'bottomEdgeMm'].includes(
    candidateFeedback?.controlKey ?? '',
  )
    ? 'base'
    : ['textEdgeFinish', 'textEdgeMm'].includes(candidateFeedback?.controlKey ?? '')
      ? 'text'
      : undefined;
  const renderCandidateFeedback = (
    group: CandidateControlGroup,
    location: 'context' | 'adjustments' = 'context',
    subcategory?: ReturnType<typeof adjustmentSubcategoryForKey>,
  ) => {
    if (!candidateFeedback || candidateFeedback.group !== group) return null;
    const belongsToAdjustments =
      candidateFeedback.controlKey !== undefined &&
      adjustmentCandidateKeys.has(candidateFeedback.controlKey);
    if (belongsToAdjustments !== (location === 'adjustments')) return null;
    if (
      location === 'adjustments' &&
      subcategory &&
      adjustmentSubcategoryForKey(candidateFeedback.controlKey) !== subcategory
    )
      return null;
    const controlLabelKey: Partial<Record<keyof KeychainParams, string>> = {
      text: 'nameInput',
      subtitle: 'subtitleInput',
      templateId: 'template',
      styleId: 'style',
      fontId: 'font',
      subtitleFontId: 'subtitleFont',
      subtitleTextSizeMm: 'subtitleSize',
      subtitleFontWeightMm: 'subtitleWeight',
      subtitleLetterSpacingMm: 'subtitleSpacing',
      subtitleGapMm: 'subtitleGap',
      subtitleOffsetXRatio: 'subtitleOffsetX',
      subtitleOffsetYRatio: 'subtitleOffsetY',
      subtitleReliefDepthMm: 'subtitleDepth',
      magnetPocketPreset: 'magnetPocketSize',
      magnetPocketPlacement: 'magnetPocketPlacement',
      keyringPreset: 'wizardKeyringOpeningTitle',
      keyringPosition: 'wizardKeyringPositionTitle',
      heartInteriorMode: 'heartInterior',
      edgeFinish: 'geometryBaseEdgeStyle',
      topEdgeMm: 'geometryBaseTopEdge',
      bottomEdgeMm: 'geometryBaseBottomEdge',
      textEdgeMm: 'geometryTextEdge',
      textEdgeFinish: 'geometryTextEdgeStyle',
      plantAccentEnabled: 'plantAccents',
    };
    const groupLabelKey: Record<CandidateControlGroup, string> = {
      name: 'name',
      template: 'template',
      'template-details': 'parameterGroupTemplateDetails',
      style: 'style',
      'style-details': 'styleDetails',
      refine: 'refine',
      print: 'print',
    };
    const key = candidateFeedback.controlKey;
    const setting =
      key && key in PARAMETER_REGISTRY
        ? t(locale, PARAMETER_REGISTRY[key as ShapeParameter].labelKey)
        : t(locale, (key && controlLabelKey[key]) || groupLabelKey[group]);
    if (candidateFeedback.status === 'checking')
      return (
        <p className="candidate-feedback" role="status" aria-live="polite">
          {t(locale, 'candidateChecking', { setting })}
        </p>
      );
    return (
      <div className="candidate-feedback candidate-feedback-rejected" role="alert">
        <p>{t(locale, 'candidateRejected', { setting })}</p>
        <button
          type="button"
          className="candidate-review-action"
          onClick={(event) => {
            const controlGroup = event.currentTarget.closest<HTMLElement>('[data-control-group]');
            const targetForCandidate = candidateFeedback.controlKey
              ? event.currentTarget
                  .closest('.controls-panel')
                  ?.querySelector<HTMLElement>(
                    `[data-candidate-key="${candidateFeedback.controlKey}"]:not(:disabled)`,
                  )
              : null;
            const target =
              targetForCandidate ??
              controlGroup?.querySelector<HTMLElement>(
                'input[type="range"]:not(:disabled), input:not([type="search"]):not(:disabled), select:not(:disabled), button:not(:disabled)',
              );
            target?.focus();
            clearCandidateFeedback();
          }}
        >
          {t(locale, 'candidateReview')}
        </button>
        {candidateFeedback.diagnostic && (
          <details>
            <summary>{t(locale, 'candidateDiagnostics')}</summary>
            <code>{candidateFeedback.diagnostic}</code>
          </details>
        )}
      </div>
    );
  };

  const hasPresentationParameters = (
    group: 'template-details' | 'style-details' | 'refine' | 'print',
  ): boolean => parametersForPresentationGroup(params, group).length > 0;
  const hasTemplateDetailRanges = hasPresentationParameters('template-details');
  const hasStyleDetailRanges = hasPresentationParameters('style-details');
  const hasShapeRanges = hasPresentationParameters('refine');
  const adjustmentGroups = [
    { key: 'template-details', visible: hasTemplateDetailRanges },
    { key: 'style-details', visible: hasStyleDetailRanges },
    { key: 'shape', visible: hasShapeRanges },
  ] as const;
  const hasPreviousVisibleAdjustmentGroup = (key: (typeof adjustmentGroups)[number]['key']) => {
    const visibleGroups = adjustmentGroups.filter((group) => group.visible);
    return visibleGroups.findIndex((group) => group.key === key) > 0;
  };

  const renderParameter = (parameter: ShapeParameter) => {
    if (!showsParameter(parameter)) return null;
    if (parameter === 'keyringSlotLengthMm' && params.keyringOpeningShape !== 'slot') return null;
    const definition = { ...rangeFor(parameter) };
    const geometryMaximum =
      parameterLimits?.[parameter as keyof NonNullable<GeometryResult['parameterLimits']>];
    if (geometryMaximum !== undefined) {
      definition.max = Math.max(
        definition.min,
        Math.floor((Math.min(definition.max, geometryMaximum) + 1e-8) / definition.step) *
          definition.step,
      );
    }
    const key = parameter as keyof KeychainParams;
    if (typeof params[key] !== 'number') return null;
    return (
      <RangeControl
        key={parameter}
        candidateKey={parameter}
        label={parameterLabel(parameter)}
        value={params[key] as number}
        {...definition}
        {...(parameter === 'edgeInsetMm' ? { min: Math.max(1.2, definition.min) } : {})}
        onChange={(value) => {
          if (
            parameter === 'holeDiameterMm' ||
            parameter === 'keyringSlotLengthMm' ||
            parameter === 'ringOffsetMm'
          ) {
            if (
              (params.keyringPreset ?? 'custom') !== 'custom' &&
              !customOpeningTransitionTracked.current
            ) {
              customOpeningTransitionTracked.current = true;
              track('customizer_option_changed', {
                family: 'keyring_opening',
                option_id: 'custom',
              });
            }
            updateMany({ [key]: value, keyringPreset: 'custom' }, 'template-details');
          } else update(key, value as never);
        }}
      />
    );
  };

  const selectKeyringPreset = (preset: KeychainParams['keyringPreset']) => {
    if (!preset || preset === 'custom') return;
    customOpeningTransitionTracked.current = false;
    updateMany(keyringPresetValues(preset), 'template-details');
  };

  return (
    <aside
      ref={controlsRef}
      className={`${styles.root} controls-panel`}
      aria-label={t(locale, 'customizerControls')}
      data-scroll-state={scrollState}
      data-editor-mode={mode}
    >
      <EditorModeSwitch locale={locale} mode={mode} onChange={changeMode} />
      <span className="controls-scroll-state sr-only" role="status" aria-live="polite">
        {scrollState === 'middle'
          ? t(locale, 'controlsScrollMiddle')
          : scrollState === 'bottom'
            ? t(locale, 'controlsScrollBottom')
            : scrollState === 'top'
              ? t(locale, 'controlsScrollTop')
              : ''}
      </span>
      <section
        className="control-section"
        data-control-group="name"
        data-testid="name-settings"
        aria-busy={candidateFeedback?.group === 'name' && candidateFeedback.status === 'checking'}
      >
        <div className="section-heading">
          <h2>{t(locale, isHeartSplit ? 'heartSplitName' : 'name')}</h2>
          <ResetIconButton
            label={t(locale, isHeartSplit ? 'resetHeartSplitName' : 'resetName')}
            onClick={() => resetSection('name')}
          />
        </div>
        <label
          className="text-input"
          data-guide-target="name"
          data-testid={isHeartSplit ? 'heart-left-input' : undefined}
        >
          <span className="sr-only">
            {t(locale, isHeartSplit ? 'heartLeftInput' : 'nameInput')}
          </span>
          <input
            data-candidate-key="text"
            aria-label={t(locale, isHeartSplit ? 'heartLeftInput' : 'nameInput')}
            value={params.text}
            maxLength={24}
            onChange={(event) => {
              updateText(event.target.value);
            }}
            placeholder={t(locale, isHeartSplit ? 'heartSplitNamePlaceholder' : 'namePlaceholder')}
          />
        </label>
        {(hasSubtitle || isHeartSplit) && (
          <label
            className="text-input subtitle-input-control"
            data-testid={isHeartSplit ? 'heart-right-input' : 'subtitle-input'}
          >
            <span className="sr-only">
              {t(locale, isHeartSplit ? 'heartRightInput' : 'subtitleInput')}
            </span>
            <input
              className="subtitle-input"
              data-candidate-key="subtitle"
              aria-label={t(locale, isHeartSplit ? 'heartRightInput' : 'subtitleInput')}
              value={params.subtitle}
              maxLength={24}
              onChange={(event) => {
                if (!event.target.value.trim()) setFontTarget('primary');
                updateSubtitle(event.target.value);
              }}
              placeholder={t(
                locale,
                isHeartSplit ? 'heartRightPlaceholder' : 'subtitlePlaceholder',
              )}
            />
          </label>
        )}
        {renderCandidateFeedback('name')}
      </section>
      {onAppearanceChange && (
        <AppearanceControls
          locale={locale}
          appearanceOverrides={appearanceOverrides}
          baseColor={baseColor}
          reliefColor={reliefColor}
          onAppearanceChange={onAppearanceChange}
        />
      )}
      <hr className="control-section-divider" />
      <div className={styles.designGroup}>
        <section
          className="control-section"
          data-guide-target="shape"
          data-testid="template-settings"
          data-control-group="template"
          aria-busy={
            candidateFeedback?.group === 'template' && candidateFeedback.status === 'checking'
          }
        >
          <div className="section-heading">
            <h2>{t(locale, 'template')}</h2>
            <ResetIconButton
              label={t(locale, 'resetTemplate')}
              onClick={() => resetSection('template')}
            />
          </div>
          <DesignCardRail
            className="template-grid"
            label={t(locale, 'templateChoices')}
            nextLabel={t(locale, 'scrollToMoreChoices')}
            previousLabel={t(locale, 'previous')}
          >
            {TEMPLATE_CATALOG.map((template) => (
              <DesignSelectCard
                key={template.id}
                title={templateName(locale, template.id, template.name)}
                description={templateDescription(locale, template.id, template.description)}
                previewSrc={TEMPLATE_PREVIEW_ASSETS[template.id]}
                selected={!neutralSelection && params.templateId === template.id}
                guideTarget={
                  !neutralSelection && params.templateId === template.id
                    ? 'shape-control'
                    : undefined
                }
                testId={`template-card-${template.id}`}
                candidateKey="templateId"
                onSelect={() => {
                  if (!template.supportsSubtitle) setFontTarget('primary');
                  customOpeningTransitionTracked.current = false;
                  selectTemplate(template.id);
                }}
              />
            ))}
          </DesignCardRail>
          {renderCandidateFeedback('template')}
        </section>
        {availableStyles.length > 0 && (
          <section
            className="control-section"
            data-control-group="style"
            aria-busy={
              candidateFeedback?.group === 'style' && candidateFeedback.status === 'checking'
            }
          >
            <div className="section-heading">
              <h2>{t(locale, 'style')}</h2>
              <ResetIconButton
                label={t(locale, 'resetStyle')}
                onClick={() => resetSection('style')}
              />
            </div>
            <DesignCardRail
              label={t(locale, 'styleChoices')}
              nextLabel={t(locale, 'scrollToMoreChoices')}
              previousLabel={t(locale, 'previous')}
            >
              {availableStyles.map((style) => (
                <DesignSelectCard
                  key={style.id}
                  title={styleName(locale, style.id, style.name)}
                  description={styleDescription(locale, style.id, style.description)}
                  previewSrc={stylePreviewAsset(params.templateId, style.id)}
                  selected={!neutralSelection && params.styleId === style.id}
                  testId={`style-card-${style.id}`}
                  candidateKey="styleId"
                  onSelect={() => update('styleId', style.id as KeychainParams['styleId'])}
                />
              ))}
            </DesignCardRail>
            {isHeartSplit && <p className="control-helper">{t(locale, 'heartSplitHelper')}</p>}
            {renderCandidateFeedback('style')}
          </section>
        )}
      </div>
      {supportsKeyring && <hr className="control-section-divider" />}
      {supportsKeyring && (
        <section
          className="control-section template-details"
          data-keyring-panel="true"
          data-control-group="template-details"
          data-testid="keyring-settings"
          aria-busy={
            candidateFeedback?.group === 'template-details' &&
            candidateFeedback.status === 'checking' &&
            ['keyringPreset', 'keyringPosition'].includes(candidateFeedback.controlKey ?? '')
          }
        >
          <h2>{t(locale, 'keyringSettings')}</h2>
          <KeyringPresetPicker
            locale={locale}
            selected={params.keyringPreset ?? 'custom'}
            openingShape={params.keyringOpeningShape ?? 'round'}
            widthMm={params.holeDiameterMm}
            lengthMm={params.keyringSlotLengthMm ?? params.holeDiameterMm}
            onSelect={selectKeyringPreset}
          />
          <KeyringPositionPicker
            locale={locale}
            selected={params.keyringPosition ?? 'left'}
            onSelect={(keyringPosition) => updateMany({ keyringPosition }, 'template-details')}
          />
          {renderCandidateFeedback('template-details')}
        </section>
      )}
      {(supportsKeyring || params.templateId === 'magnet') && (
        <hr className="control-section-divider" />
      )}
      {params.templateId === 'magnet' && (
        <section
          className="control-section template-details"
          data-control-group="template-details"
          aria-busy={
            candidateFeedback?.group === 'template-details' &&
            candidateFeedback.status === 'checking' &&
            !adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
          }
        >
          <h2>{t(locale, 'parameterGroupTemplateDetails')}</h2>
          <div className="control-subsection magnet-controls" data-testid="magnet-controls">
            <h3>{t(locale, 'magnetControls')}</h3>
            <label className="select-control">
              <span>{t(locale, 'magnetPocketSize')}</span>
              <select
                data-candidate-key="magnetPocketPreset"
                aria-label={t(locale, 'magnetPocketSize')}
                value={params.magnetPocketPreset}
                onChange={(event) =>
                  update(
                    'magnetPocketPreset',
                    event.target.value as KeychainParams['magnetPocketPreset'],
                  )
                }
              >
                {MAGNET_POCKET_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.id} {t(locale, 'millimeterUnit')}
                  </option>
                ))}
              </select>
              <small>
                {(() => {
                  const preset =
                    MAGNET_POCKET_PRESETS.find((item) => item.id === params.magnetPocketPreset) ??
                    MAGNET_POCKET_PRESETS[2];
                  return t(locale, 'magnetPocketDetails', {
                    diameter: (preset.diameterMm + 0.4).toFixed(1),
                    depth: (preset.thicknessMm + 0.2).toFixed(1),
                  });
                })()}
              </small>
            </label>
            <label className="select-control">
              <span>{t(locale, 'magnetPocketPlacement')}</span>
              <select
                data-candidate-key="magnetPocketPlacement"
                aria-label={t(locale, 'magnetPocketPlacement')}
                value={params.magnetPocketPlacement}
                onChange={(event) =>
                  update(
                    'magnetPocketPlacement',
                    event.target.value as KeychainParams['magnetPocketPlacement'],
                  )
                }
              >
                {(['center', 'upper', 'lower', 'left', 'right'] as const).map((placement) => (
                  <option key={placement} value={placement}>
                    {t(locale, `magnetPlacement${placement[0].toUpperCase()}${placement.slice(1)}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {renderCandidateFeedback('template-details')}
        </section>
      )}
      {params.templateId === 'magnet' && <hr className="control-section-divider" />}
      {isHeartSplit && (
        <section
          className="control-section style-details"
          data-control-group="style-details"
          data-testid={isHeartSplit ? 'heart-settings' : 'style-details-settings'}
          aria-busy={
            candidateFeedback?.group === 'style-details' &&
            candidateFeedback.status === 'checking' &&
            !adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
          }
        >
          <h2>{t(locale, isHeartSplit ? 'heartSettings' : 'styleDetails')}</h2>
          <label className="select-control">
            <span>{t(locale, 'heartInterior')}</span>
            <select
              data-candidate-key="heartInteriorMode"
              aria-label={t(locale, 'heartInterior')}
              value={params.heartInteriorMode}
              onChange={(event) =>
                update('heartInteriorMode', event.target.value as HeartInteriorMode)
              }
            >
              <option value="relief">{t(locale, 'heartInteriorRelief')}</option>
              <option value="through-cut">{t(locale, 'heartInteriorThroughCut')}</option>
            </select>
            <span className="control-helper">{t(locale, 'heartInteriorHelper')}</span>
          </label>
          {renderCandidateFeedback('style-details')}
        </section>
      )}
      {isHeartSplit && <hr className="control-section-divider" />}
      <section
        className="control-section refine-settings"
        data-control-group="refine"
        aria-busy={
          candidateFeedback?.group === 'refine' &&
          candidateFeedback.status === 'checking' &&
          !adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
        }
      >
        <h2>{t(locale, 'refine')}</h2>
        {mode === 'simple' && (
          <>
            {renderFontTargetSwitch('simple-font-target')}
            <SimpleFontPicker
              locale={locale}
              params={params}
              target={activeFontTarget}
              selectedName={
                activeFontTarget === 'secondary' ? selectedSubtitleFont.name : selectedFont.name
              }
              suggestions={fontSuggestions}
              neutralSelection={neutralSelection}
              onSelect={(fontId) => {
                if (activeFontTarget === 'secondary') updateSubtitleFont(fontId);
                else update('fontId', fontId);
              }}
              onMore={fontChooser.show}
            />
            {fontNotice && (
              <p className="font-notice" aria-live="polite">
                {t(
                  locale,
                  fontNotice.articulated
                    ? 'fontArticulatedFallback'
                    : fontNotice.target === 'subtitle'
                      ? 'fontSubtitleFallback'
                      : 'fontFallback',
                  {
                    font: fontNotice.font,
                    replacement: fontNotice.replacement,
                  },
                )}
              </p>
            )}
          </>
        )}
        {mode === 'pro' && (
          <FontBrowser
            locale={locale}
            customizer={customizer}
            target={activeFontTarget}
            targetSwitch={renderFontTargetSwitch('font-browser-target')}
            favoriteFontCategories={favoriteFontCategories}
            neutralSelection={neutralSelection}
            bootFrame={bootFrame}
            resetActiveFont={resetActiveFont}
            resetActiveFontLabel={resetActiveFontLabel}
          />
        )}
        {!fontChooser.open && renderCandidateFeedback('refine')}
      </section>
      <FontChooserDialog
        locale={locale}
        open={fontChooser.open}
        busy={fontChooser.busy}
        onClose={fontChooser.close}
      >
        <FontBrowser
          locale={locale}
          customizer={customizer}
          target={activeFontTarget}
          targetSwitch={renderFontTargetSwitch('font-chooser-target')}
          favoriteFontCategories={favoriteFontCategories}
          resetActiveFont={resetActiveFont}
          resetActiveFontLabel={resetActiveFontLabel}
          onFontProposed={fontChooser.proposed}
          showReset={false}
        />
        {renderCandidateFeedback('refine')}
      </FontChooserDialog>
      {!bootFrame && <hr className="control-section-divider" />}
      {!bootFrame && mode === 'simple' && (
        <SimpleAdjustments
          locale={locale}
          params={params}
          baseFinishLimits={baseFinishLimits}
          textFinishLimits={textFinishLimits}
          updateMany={updateMany}
          baseFinishFeedback={
            finishFeedbackTarget === 'base'
              ? renderCandidateFeedback('print', 'adjustments', 'print')
              : null
          }
          textFinishFeedback={
            finishFeedbackTarget === 'text'
              ? renderCandidateFeedback('print', 'adjustments', 'print')
              : null
          }
          renderFeedback={(group, presentation) =>
            presentation === 'print' && finishFeedbackTarget
              ? null
              : renderCandidateFeedback(group, 'adjustments', presentation)
          }
          onPro={openPro}
          onReset={() => {
            setFontTarget('primary');
            onReset();
          }}
        />
      )}
      {!bootFrame && mode === 'pro' && (
        <section
          className="control-section adjustment-settings"
          data-control-group="adjustments"
          data-testid="adjustment-settings"
          aria-busy={
            candidateFeedback?.status === 'checking' &&
            adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
          }
        >
          <h2>{t(locale, 'adjustments')}</h2>
          <div
            className="control-subsection adjustment-category"
            data-adjustment-subcategory="typography"
            data-control-group="refine"
            data-testid="typography-adjustments"
          >
            <div className="section-heading">
              <h3>{t(locale, 'typography')}</h3>
              <ResetIconButton
                label={t(locale, 'resetShape')}
                onClick={() => resetSection('shape')}
              />
            </div>
            <div className="control-subsection shape-font-settings" data-testid="font-settings">
              {renderFontTargetSwitch('shape-font-target')}
              {activeFontTarget === 'primary' && (
                <div className="range-grid">
                  {renderParameter('textSizeMm')}
                  {renderParameter('fontWeightMm')}
                  {renderParameter('letterSpacingMm')}
                </div>
              )}
              {hasSubtitle && hasSubtitleText && (
                <div className="subtitle-controls" data-testid="subtitle-settings">
                  <div className="section-heading">
                    <h4>{t(locale, 'subtitle')}</h4>
                    <ResetIconButton
                      label={t(locale, 'resetSubtitle')}
                      onClick={() => {
                        setFontTarget('primary');
                        resetSection('subtitle');
                      }}
                    />
                  </div>
                  {activeFontTarget === 'secondary' && (
                    <>
                      <RangeControl
                        candidateKey="subtitleTextSizeMm"
                        label={t(locale, 'subtitleSize')}
                        value={params.subtitleTextSizeMm ?? 6}
                        min={4}
                        max={12}
                        step={0.5}
                        unit="mm"
                        onChange={(value) => update('subtitleTextSizeMm', value)}
                      />
                      <RangeControl
                        candidateKey="subtitleFontWeightMm"
                        label={t(locale, 'subtitleWeight')}
                        value={params.subtitleFontWeightMm ?? 0}
                        min={0}
                        max={1.5}
                        step={0.1}
                        unit="mm"
                        onChange={(value) => update('subtitleFontWeightMm', value)}
                      />
                      <RangeControl
                        candidateKey="subtitleLetterSpacingMm"
                        label={t(locale, 'subtitleSpacing')}
                        value={params.subtitleLetterSpacingMm ?? 0.5}
                        min={0}
                        max={4}
                        step={0.1}
                        unit="mm"
                        onChange={(value) => update('subtitleLetterSpacingMm', value)}
                      />
                      <RangeControl
                        candidateKey="subtitleGapMm"
                        label={t(locale, 'subtitleGap')}
                        value={params.subtitleGapMm ?? 1.5}
                        min={1.5}
                        max={8}
                        step={0.1}
                        unit="mm"
                        onChange={(value) => update('subtitleGapMm', value)}
                      />
                      <RangeControl
                        candidateKey="subtitleOffsetXRatio"
                        label={t(locale, 'subtitleOffsetX')}
                        value={params.subtitleOffsetXRatio * 100}
                        min={-100}
                        max={100}
                        step={5}
                        unit="%"
                        onChange={(value) => update('subtitleOffsetXRatio', value / 100)}
                      />
                      <RangeControl
                        candidateKey="subtitleOffsetYRatio"
                        label={t(locale, 'subtitleOffsetY')}
                        value={params.subtitleOffsetYRatio * 100}
                        min={-100}
                        max={100}
                        step={5}
                        unit="%"
                        onChange={(value) => update('subtitleOffsetYRatio', value / 100)}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            {renderCandidateFeedback('refine', 'adjustments', 'typography')}
          </div>
          {hasTemplateDetailRanges && (
            <div
              className="control-subsection adjustment-category"
              data-adjustment-subcategory="template-details"
              data-control-group="template-details"
              data-testid="template-detail-adjustments"
              aria-busy={
                candidateFeedback?.group === 'template-details' &&
                candidateFeedback.status === 'checking' &&
                adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
              }
            >
              <h3>{t(locale, 'parameterGroupTemplateDetails')}</h3>
              <ParameterGroupList
                locale={locale}
                params={params}
                presentation="template-details"
                showsParameter={showsParameter}
                update={update}
                renderParameter={renderParameter}
              />
              {renderCandidateFeedback('template-details', 'adjustments', 'template-details')}
            </div>
          )}
          {hasPreviousVisibleAdjustmentGroup('style-details') && (
            <hr className="control-subsection-divider" />
          )}
          {hasStyleDetailRanges && (
            <div
              className="control-subsection adjustment-category"
              data-adjustment-subcategory="style-details"
              data-control-group="style-details"
              data-testid="style-detail-adjustments"
              aria-busy={
                candidateFeedback?.group === 'style-details' &&
                candidateFeedback.status === 'checking' &&
                adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
              }
            >
              <h3>{t(locale, 'styleDetails')}</h3>
              <ParameterGroupList
                locale={locale}
                params={params}
                presentation="style-details"
                showsParameter={showsParameter}
                update={update}
                renderParameter={renderParameter}
              />
              {renderCandidateFeedback('style-details', 'adjustments', 'style-details')}
            </div>
          )}
          {hasPreviousVisibleAdjustmentGroup('shape') && (
            <hr className="control-subsection-divider" />
          )}
          {hasShapeRanges && (
            <div
              className="control-subsection adjustment-category"
              data-adjustment-subcategory="shape"
              data-control-group="refine"
              data-testid="shape-adjustments"
            >
              <h3>{t(locale, 'shape')}</h3>
              <ParameterGroupList
                locale={locale}
                params={params}
                presentation="refine"
                showsParameter={showsParameter}
                update={update}
                renderParameter={renderParameter}
              />
              {renderCandidateFeedback('refine', 'adjustments', 'shape')}
            </div>
          )}
          <div
            className="control-subsection adjustment-category"
            data-adjustment-subcategory="print"
            data-control-group="print"
            data-testid="print-settings"
            aria-busy={
              candidateFeedback?.group === 'print' &&
              candidateFeedback.status === 'checking' &&
              adjustmentCandidateKeys.has(candidateFeedback.controlKey ?? '')
            }
          >
            <h3>{t(locale, 'print')}</h3>
            <ParameterGroupList
              locale={locale}
              params={params}
              presentation="print"
              showsParameter={showsParameter}
              update={update}
              renderParameter={renderParameter}
            />
            {hasSubtitle && hasSubtitleText && activeFontTarget === 'secondary' && (
              <RangeControl
                candidateKey="subtitleReliefDepthMm"
                label={t(locale, 'subtitleDepth')}
                value={params.subtitleReliefDepthMm ?? 0.8}
                min={0.4}
                max={1.5}
                step={0.1}
                unit="mm"
                onChange={(value) => update('subtitleReliefDepthMm', value)}
              />
            )}
            <GeometryFinishControls
              locale={locale}
              params={params}
              baseFinishLimits={baseFinishLimits}
              limits={textFinishLimits}
              updateMany={updateMany}
              baseFeedback={
                finishFeedbackTarget === 'base'
                  ? renderCandidateFeedback('print', 'adjustments', 'print')
                  : null
              }
              textFeedback={
                finishFeedbackTarget === 'text'
                  ? renderCandidateFeedback('print', 'adjustments', 'print')
                  : null
              }
            />
            {!finishFeedbackTarget && renderCandidateFeedback('print', 'adjustments', 'print')}
          </div>
          <button
            type="button"
            className="reset-settings"
            onClick={() => {
              setFontTarget('primary');
              onReset();
            }}
          >
            {t(locale, 'resetSettings')}
          </button>
          <div className="controls-scroll-spacer" aria-hidden="true" />
        </section>
      )}
    </aside>
  );
};
