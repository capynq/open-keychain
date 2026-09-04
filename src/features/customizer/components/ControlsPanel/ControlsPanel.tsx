import { ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  FONT_CATEGORY_ORDER,
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  type FontCategory,
} from '@/domain/keychain/fonts/catalog';
import { PARAMETER_REGISTRY, type ShapeParameter } from '@/domain/keychain/model/parameters';
import {
  MAGNET_POCKET_PRESETS,
  type HeartInteriorMode,
  type KeychainParams,
} from '@/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';
import { type useCustomizerParams } from '@/features/customizer/hooks/useCustomizerParams';
import {
  styleDescription,
  styleName,
  templateDescription,
  templateName,
  t,
  type Locale,
} from '@/infrastructure/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import { stylePreviewAsset, TEMPLATE_PREVIEW_ASSETS } from '../design-card-assets';
import { DesignCardRail } from '../DesignCardRail/DesignCardRail';
import { DesignSelectCard } from '../DesignSelectCard/DesignSelectCard';
import { RangeControl } from '../RangeControl/RangeControl';
import styles from './ControlsPanel.module.css';
import { ParameterGroupList } from './ParameterGroupList';
import { useControlsScrollState } from './useControlsScrollState';

type FontSourceTab = 'bundled' | 'google' | 'local';
type FontTarget = 'primary' | 'secondary';
type FontBrowserState = {
  search: string;
  page: number;
  category: FontCategory | 'all';
  supportsTextOnly: boolean;
};

const INITIAL_FONT_BROWSER_STATE: Record<FontSourceTab, FontBrowserState> = {
  bundled: { search: '', page: 1, category: 'all', supportsTextOnly: true },
  google: { search: '', page: 1, category: 'all', supportsTextOnly: true },
  local: { search: '', page: 1, category: 'all', supportsTextOnly: true },
};

export const ControlsPanel = ({
  locale,
  customizer,
  onReset,
}: {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  onReset: () => void;
}) => {
  const {
    params,
    selectedFont,
    selectedSubtitleFont,
    availableStyles,
    usesCyrillic,
    fontNotice,
    update,
    updateText,
    updateSubtitle,
    updateSubtitleFont,
    selectTemplate,
    resetSection,
    showsParameter,
    rangeFor,
  } = customizer;
  const [fontSource, setFontSource] = useState<FontSourceTab>('bundled');
  const [fontTarget, setFontTarget] = useState<FontTarget>('primary');
  const [fontBrowserState, setFontBrowserState] = useState(INITIAL_FONT_BROWSER_STATE);
  const [fontLoadError, setFontLoadError] = useState(false);
  const [loadingFontId, setLoadingFontId] = useState<string>();
  const [loadedGoogleFontIds, setLoadedGoogleFontIds] = useState<Set<string>>(() => new Set());
  const [googleFontLoadPromises] = useState(() => new Map<string, Promise<boolean>>());
  const [previewFontId, setPreviewFontId] = useState<string>();
  const [openCategories, setOpenCategories] = useState<Set<FontCategory>>(
    () => new Set(FONT_CATEGORY_ORDER),
  );
  const { controlsRef, scrollState } = useControlsScrollState();
  const fileSystemPickerAvailable =
    typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
  const fontsPerPage = 12;
  const activeBrowserState = fontBrowserState[fontSource];
  const hasSubtitle =
    params.styleId !== 'heart-split' &&
    TEMPLATE_CATALOG.find((template) => template.id === params.templateId)?.supportsSubtitle ===
      true;
  const isHeartSplit = params.styleId === 'heart-split';
  const hasSubtitleText = params.subtitle.trim().length > 0;
  const activeFontTarget: FontTarget = hasSubtitle && hasSubtitleText ? fontTarget : 'primary';
  const activeTargetText = activeFontTarget === 'secondary' ? params.subtitle : params.text;
  const activeTargetFontId =
    activeFontTarget === 'secondary' ? params.subtitleFontId : params.fontId;

  const sourceFonts =
    fontSource === 'google'
      ? customizer.googleFonts
      : fontSource === 'local'
        ? customizer.localFonts.flatMap((record) => (record.font ? [record.font] : []))
        : FONT_CATALOG;
  const compatibleFonts = useMemo(
    () =>
      sourceFonts.filter((font) =>
        activeFontTarget === 'primary' && params.templateId === 'articulated-name'
          ? fontSupportsArticulatedName(font, activeTargetText)
          : !activeBrowserState.supportsTextOnly || fontSupportsText(font, activeTargetText),
      ),
    [
      activeBrowserState.supportsTextOnly,
      activeFontTarget,
      activeTargetText,
      params.templateId,
      sourceFonts,
    ],
  );
  const filteredFonts = useMemo(() => {
    const query = activeBrowserState.search.trim().toLocaleLowerCase();
    return compatibleFonts.filter(
      (font) =>
        (activeBrowserState.category === 'all' || font.category === activeBrowserState.category) &&
        (!query ||
          font.name.toLocaleLowerCase().includes(query) ||
          font.category.toLocaleLowerCase().includes(query)),
    );
  }, [activeBrowserState.category, activeBrowserState.search, compatibleFonts]);
  const shouldPaginate = fontSource === 'google';
  const pageCount = shouldPaginate
    ? Math.max(1, Math.ceil(filteredFonts.length / fontsPerPage))
    : 1;
  const currentPage = Math.min(activeBrowserState.page, pageCount);
  const visibleFonts = shouldPaginate
    ? filteredFonts.slice((currentPage - 1) * fontsPerPage, currentPage * fontsPerPage)
    : filteredFonts;
  const updateFontBrowserState = (changes: Partial<FontBrowserState>): void => {
    setFontBrowserState((current) => ({
      ...current,
      [fontSource]: { ...current[fontSource], ...changes },
    }));
  };
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

  const activateFontSource = (source: FontSourceTab): void => {
    setFontSource(source);
    if (source === 'google' && !customizer.googleFonts.length && !customizer.googleError)
      void customizer.loadGoogleFonts();
  };
  const loadGoogleFont = async (font: (typeof FONT_CATALOG)[number]): Promise<boolean> => {
    if (
      (font.source !== 'google' && font.source !== 'local') ||
      loadedGoogleFontIds.has(font.id) ||
      typeof FontFace === 'undefined'
    )
      return true;

    const existingLoad = googleFontLoadPromises.get(font.id);
    if (existingLoad) return existingLoad;

    const load = (async () => {
      try {
        const source =
          font.source === 'local' && font.data
            ? URL.createObjectURL(new Blob([font.data], { type: 'font/ttf' }))
            : font.file;
        const face = new FontFace(font.previewFamily, `url(${source})`, {
          weight: String(font.weight),
        });
        await face.load();
        document.fonts.add(face);
        if (font.source === 'local' && source.startsWith('blob:')) URL.revokeObjectURL(source);
        setLoadedGoogleFontIds((current) => new Set(current).add(font.id));
        return true;
      } catch {
        return false;
      } finally {
        googleFontLoadPromises.delete(font.id);
      }
    })();
    googleFontLoadPromises.set(font.id, load);
    return load;
  };
  const selectFont = async (font: (typeof FONT_CATALOG)[number]): Promise<void> => {
    setFontLoadError(false);
    setLoadingFontId(font.id);
    if (!(await loadGoogleFont(font))) {
      setFontLoadError(true);
      setLoadingFontId(undefined);
      return;
    }
    if (activeFontTarget === 'secondary') updateSubtitleFont(font.id);
    else update('fontId', font.id);
    setLoadingFontId(undefined);
  };
  const renderFontGroups = (fonts: typeof FONT_CATALOG) => (
    <div className="font-groups">
      {FONT_CATEGORY_ORDER.map((category) => {
        const categoryFonts = fonts.filter((font) => font.category === category);
        if (!categoryFonts.length) return null;
        return (
          <details
            className="font-group"
            key={category}
            open={openCategories.has(category)}
            onToggle={(event) => {
              const next = new Set(openCategories);
              if (event.currentTarget.open) next.add(category);
              else next.delete(category);
              setOpenCategories(next);
            }}
          >
            <summary>
              <h3>{t(locale, `fontCategory${category.replace(/[^A-Za-z]/g, '')}`)}</h3>
            </summary>
            <div
              className={`font-grid ${params.templateId === 'articulated-name' ? 'articulated-font-grid' : ''}`}
            >
              {categoryFonts.map((font) => (
                <div className="font-card-wrap" key={font.id}>
                  <button
                    type="button"
                    className={`font-card ${activeTargetFontId === font.id ? 'selected' : ''} ${previewFontId === font.id ? 'previewing' : ''}`}
                    data-font-state={
                      loadingFontId === font.id
                        ? 'loading'
                        : activeTargetFontId === font.id
                          ? 'selected'
                          : 'idle'
                    }
                    onClick={() => void selectFont(font)}
                    disabled={loadingFontId !== undefined}
                    aria-busy={loadingFontId === font.id}
                    aria-pressed={activeTargetFontId === font.id}
                    aria-label={`${t(locale, 'selectFont')}: ${font.name}`}
                    onMouseEnter={() => {
                      setPreviewFontId(font.id);
                      void loadGoogleFont(font);
                    }}
                    onMouseLeave={() => setPreviewFontId(undefined)}
                    onFocus={() => {
                      setPreviewFontId(font.id);
                      void loadGoogleFont(font);
                    }}
                    onBlur={() => setPreviewFontId(undefined)}
                    title={font.name}
                  >
                    <span style={{ fontFamily: font.previewFamily, fontWeight: font.weight }}>
                      {activeTargetText || (usesCyrillic ? font.sampleCyrillic : font.sampleLatin)}
                    </span>
                    <small>
                      {loadingFontId === font.id
                        ? t(locale, 'fontLoading')
                        : activeTargetFontId === font.id
                          ? `${font.name} · ${t(locale, 'fontSelected')}`
                          : font.name}
                    </small>
                  </button>
                  {font.specimenUrl && (
                    <a href={font.specimenUrl} target="_blank" rel="noreferrer">
                      {t(locale, 'fontSpecimen')} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
  const fontFilters = (
    <details className="font-filter-disclosure">
      <summary>{t(locale, 'filterFonts')}</summary>
      <div className="font-filter-row">
        <label>
          <span>{t(locale, 'fontCategoryFilter')}</span>
          <select
            aria-label={t(locale, 'fontCategoryFilter')}
            value={activeBrowserState.category}
            onChange={(event) => {
              updateFontBrowserState({
                category: event.target.value as FontCategory | 'all',
                page: 1,
              });
            }}
          >
            <option value="all">{t(locale, 'fontCategoryAll')}</option>
            {FONT_CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {t(locale, `fontCategory${category.replace(/[^A-Za-z]/g, '')}`)}
              </option>
            ))}
          </select>
        </label>
        {params.templateId !== 'articulated-name' && (
          <label className="font-compatibility-toggle">
            <input
              type="checkbox"
              checked={activeBrowserState.supportsTextOnly}
              onChange={(event) => {
                updateFontBrowserState({ supportsTextOnly: event.target.checked, page: 1 });
              }}
            />
            <span>{t(locale, 'fontSupportsText')}</span>
          </label>
        )}
        <IconButton
          action="clear-font-filters"
          className="font-filter-clear"
          icon={RefreshCw}
          label={t(locale, 'clearFontFilters')}
          disabled={
            activeBrowserState.category === 'all' &&
            activeBrowserState.search === '' &&
            activeBrowserState.supportsTextOnly
          }
          onClick={() =>
            updateFontBrowserState({ search: '', category: 'all', supportsTextOnly: true, page: 1 })
          }
        />
      </div>
    </details>
  );

  const parameterLabel = (parameter: ShapeParameter): string => {
    if (parameter === 'baseThicknessMm')
      return t(locale, params.templateId === 'nameplate' ? 'plateThickness' : 'baseThickness');
    if (parameter === 'reliefDepthMm')
      return t(locale, params.templateId === 'nameplate' ? 'textLift' : 'raisedText');
    if (parameter === 'edgeInsetMm') return t(locale, 'edgeInset');
    return t(locale, PARAMETER_REGISTRY[parameter].labelKey);
  };

  const renderParameter = (parameter: ShapeParameter) => {
    if (!showsParameter(parameter)) return null;
    const definition = rangeFor(parameter);
    const key = parameter as keyof KeychainParams;
    if (typeof params[key] !== 'number') return null;
    return (
      <RangeControl
        key={parameter}
        label={parameterLabel(parameter)}
        value={params[key] as number}
        {...definition}
        {...(parameter === 'edgeInsetMm' ? { min: Math.max(1.2, definition.min) } : {})}
        onChange={(value) => update(key, value as never)}
      />
    );
  };

  return (
    <aside
      ref={controlsRef}
      className={`${styles.root} controls-panel`}
      aria-label={t(locale, 'customizerControls')}
      data-scroll-state={scrollState}
    >
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
        data-control-group="essentials"
        data-testid="name-settings"
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
      </section>
      <section
        className="control-section"
        data-guide-target="shape"
        data-testid="template-settings"
        data-control-group="design"
      >
        <div className="section-heading">
          <h2>{t(locale, 'template')}</h2>
          <ResetIconButton
            label={t(locale, 'resetTemplate')}
            onClick={() => resetSection('template')}
          />
        </div>
        <DesignCardRail className="template-grid" label={t(locale, 'templateChoices')}>
          {TEMPLATE_CATALOG.map((template) => (
            <DesignSelectCard
              key={template.id}
              title={templateName(locale, template.id, template.name)}
              description={templateDescription(locale, template.id, template.description)}
              previewSrc={TEMPLATE_PREVIEW_ASSETS[template.id]}
              selected={params.templateId === template.id}
              guideTarget={params.templateId === template.id ? 'shape-control' : undefined}
              testId={`template-card-${template.id}`}
              onSelect={() => {
                if (!template.supportsSubtitle) setFontTarget('primary');
                selectTemplate(template.id);
              }}
            />
          ))}
        </DesignCardRail>
      </section>
      {availableStyles.length > 0 && (
        <section className="control-section" data-control-group="design">
          <div className="section-heading">
            <h2>{t(locale, 'style')}</h2>
            <ResetIconButton
              label={t(locale, 'resetStyle')}
              onClick={() => resetSection('style')}
            />
          </div>
          <DesignCardRail label={t(locale, 'styleChoices')}>
            {availableStyles.map((style) => (
              <DesignSelectCard
                key={style.id}
                title={styleName(locale, style.id, style.name)}
                description={styleDescription(locale, style.id, style.description)}
                previewSrc={stylePreviewAsset(params.templateId, style.id)}
                selected={params.styleId === style.id}
                testId={`style-card-${style.id}`}
                onSelect={() => update('styleId', style.id as KeychainParams['styleId'])}
              />
            ))}
          </DesignCardRail>
          {isHeartSplit && <p className="control-helper">{t(locale, 'heartSplitHelper')}</p>}
        </section>
      )}
      {params.templateId === 'magnet' && (
        <section className="control-section magnet-controls" data-control-group="print">
          <div className="section-heading">
            <h2>{t(locale, 'magnetControls')}</h2>
          </div>
          <label className="select-control">
            <span>{t(locale, 'magnetPocketSize')}</span>
            <select
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
        </section>
      )}
      <section className="control-section" data-control-group="design" data-testid="font-browser">
        <div className="section-heading">
          <h2>
            {t(locale, 'font')}{' '}
            <span className="selected-note">
              {activeFontTarget === 'secondary' ? selectedSubtitleFont.name : selectedFont.name}
            </span>
          </h2>
          <ResetIconButton label={resetActiveFontLabel} onClick={resetActiveFont} />
        </div>
        {renderFontTargetSwitch('font-browser-target')}
        <div className="font-source-tabs" role="tablist" aria-label={t(locale, 'fontSources')}>
          {(['bundled', 'google', 'local'] as const).map((source, index) => (
            <button
              type="button"
              role="tab"
              id={`font-tab-${source}`}
              aria-controls={`font-panel-${source}`}
              aria-selected={fontSource === source}
              tabIndex={fontSource === source ? 0 : -1}
              className={fontSource === source ? 'active' : ''}
              key={source}
              onClick={() => activateFontSource(source)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const direction = event.key === 'ArrowLeft' ? -1 : 1;
                const nextIndex =
                  event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + direction + 3) % 3;
                const nextSource = (['bundled', 'google', 'local'] as const)[nextIndex];
                activateFontSource(nextSource);
                document.getElementById(`font-tab-${nextSource}`)?.focus();
              }}
            >
              {t(
                locale,
                source === 'bundled'
                  ? 'fontSourceLocal'
                  : source === 'google'
                    ? 'fontSourceGoogle'
                    : 'fontSourceImported',
              )}
            </button>
          ))}
        </div>
        <div
          className="font-panel"
          id={`font-panel-${fontSource}`}
          role="tabpanel"
          aria-labelledby={`font-tab-${fontSource}`}
        >
          {fontSource === 'google' ? (
            customizer.googleLoading ? (
              <p className="font-provider-state" role="status">
                {t(locale, 'fontGoogleLoading')}
              </p>
            ) : customizer.googleError ? (
              <div className="font-provider-state" role="status">
                <p>{t(locale, 'fontGoogleUnavailable')}</p>
                <IconButton
                  action="retry-google-fonts"
                  icon={RefreshCw}
                  label={t(locale, 'retry')}
                  onClick={() => void customizer.loadGoogleFonts()}
                />
              </div>
            ) : (
              <>
                <label className="font-search">
                  <span className="sr-only">{t(locale, 'fontSearch')}</span>
                  <input
                    type="search"
                    value={activeBrowserState.search}
                    onChange={(event) =>
                      updateFontBrowserState({ search: event.target.value, page: 1 })
                    }
                    placeholder={t(locale, 'fontSearchPlaceholder')}
                    aria-label={t(locale, 'fontSearch')}
                  />
                </label>
                {fontFilters}
                {params.templateId === 'articulated-name' && (
                  <p className="font-restriction">{t(locale, 'fontArticulatedRestriction')}</p>
                )}
                {visibleFonts.length ? (
                  renderFontGroups(visibleFonts)
                ) : (
                  <p className="font-provider-state">
                    {customizer.googleFonts.length === 0 && !activeBrowserState.search
                      ? t(locale, 'fontGoogleEmpty')
                      : t(locale, 'fontNoResults')}
                  </p>
                )}
                {pageCount > 1 && (
                  <nav className="font-pagination" aria-label={t(locale, 'fontPagination')}>
                    <IconButton
                      action="font-page-previous"
                      icon={ChevronLeft}
                      label={t(locale, 'previous')}
                      disabled={currentPage === 1}
                      onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                    />
                    <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                    <IconButton
                      action="font-page-next"
                      icon={ChevronRight}
                      label={t(locale, 'next')}
                      disabled={currentPage === pageCount}
                      onClick={() => updateFontBrowserState({ page: activeBrowserState.page + 1 })}
                    />
                  </nav>
                )}
              </>
            )
          ) : (
            <>
              {fontSource === 'local' && (
                <div className="font-provider-state font-local-provider-state">
                  <p>{t(locale, 'fontLocalDescription')}</p>
                  <div className="font-local-actions">
                    {!fileSystemPickerAvailable && (
                      <input
                        type="file"
                        accept=".ttf,.otf,font/ttf,font/otf"
                        multiple
                        onChange={(event) => {
                          if (event.target.files)
                            void customizer.importLocalFonts(event.target.files);
                          event.currentTarget.value = '';
                        }}
                      />
                    )}
                    {fileSystemPickerAvailable && (
                      <button type="button" onClick={() => void customizer.pickLocalFonts()}>
                        {t(locale, 'fontLocalChoose')}
                      </button>
                    )}
                    <details className="font-local-about">
                      <summary
                        aria-label={t(locale, 'fontLocalAbout')}
                        title={t(locale, 'fontLocalAbout')}
                      >
                        <Info aria-hidden="true" focusable="false" size={16} strokeWidth={2} />
                      </summary>
                      <p>{t(locale, 'fontLocalAboutDescription')}</p>
                    </details>
                  </div>
                  {customizer.localFonts
                    .filter((record) => record.status === 'unavailable')
                    .map((record) => (
                      <p key={record.id} role="status">
                        {record.name} · {t(locale, 'fontLocalUnavailable')}{' '}
                        <button
                          type="button"
                          onClick={() => void customizer.reconnectLocalFont(record.id)}
                        >
                          {t(locale, 'fontLocalReconnect')}
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => void customizer.removeLocalFont(record.id)}
                        >
                          {t(locale, 'remove')}
                        </button>
                      </p>
                    ))}
                </div>
              )}
              <label className="font-search">
                <span className="sr-only">{t(locale, 'fontSearch')}</span>
                <input
                  type="search"
                  value={activeBrowserState.search}
                  onChange={(event) => {
                    updateFontBrowserState({ search: event.target.value, page: 1 });
                  }}
                  placeholder={t(locale, 'fontSearchPlaceholder')}
                  aria-label={t(locale, 'fontSearch')}
                />
              </label>
              {fontFilters}
              {params.templateId === 'articulated-name' && (
                <p className="font-restriction">{t(locale, 'fontArticulatedRestriction')}</p>
              )}
              {visibleFonts.length === 0 ? (
                <p className="font-provider-state">{t(locale, 'fontNoResults')}</p>
              ) : (
                renderFontGroups(visibleFonts)
              )}
              {pageCount > 1 && (
                <nav className="font-pagination" aria-label={t(locale, 'fontPagination')}>
                  <IconButton
                    action="font-page-previous"
                    icon={ChevronLeft}
                    label={t(locale, 'previous')}
                    disabled={currentPage === 1}
                    onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                  />
                  <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                  <IconButton
                    action="font-page-next"
                    icon={ChevronRight}
                    label={t(locale, 'next')}
                    disabled={currentPage === pageCount}
                    onClick={() => updateFontBrowserState({ page: activeBrowserState.page + 1 })}
                  />
                </nav>
              )}
            </>
          )}
        </div>
        <footer className="font-attribution">
          <span>
            {t(
              locale,
              fontSource === 'google'
                ? 'fontSourceGoogle'
                : fontSource === 'local'
                  ? 'fontSourceImported'
                  : 'fontSourceLocal',
            )}
          </span>
          {fontSource === 'google' ? (
            <a href="https://fonts.google.com" target="_blank" rel="noreferrer">
              {t(locale, 'fontGoogleAttribution')} ↗
            </a>
          ) : (
            <span>{t(locale, 'fontSourceLocal')}</span>
          )}
        </footer>
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
        {fontLoadError && (
          <p className="font-notice" role="alert">
            {t(locale, 'fontRuntimeLoadFailed')}
          </p>
        )}
      </section>
      <section
        className="control-section shape-settings"
        data-control-group="print"
        data-testid="shape-settings"
      >
        <div className="section-heading">
          <h2>{t(locale, 'shape')}</h2>
          <ResetIconButton label={t(locale, 'resetShape')} onClick={() => resetSection('shape')} />
        </div>
        <div className="control-subsection shape-font-settings" data-testid="font-settings">
          <div className="section-heading">
            <h3>{t(locale, 'fontSettings')}</h3>
            {activeFontTarget === 'primary' && (
              <ResetIconButton label={resetActiveFontLabel} onClick={resetActiveFont} />
            )}
          </div>
          {renderFontTargetSwitch('shape-font-target')}
          {activeFontTarget === 'primary' && (
            <div className="range-grid">
              {renderParameter('textSizeMm')}
              {renderParameter('fontWeightMm')}
              {renderParameter('letterSpacingMm')}
              {renderParameter('reliefDepthMm')}
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
              {activeFontTarget === 'secondary' && hasSubtitleText && (
                <>
                  <RangeControl
                    label={t(locale, 'subtitleSize')}
                    value={params.subtitleTextSizeMm ?? 6}
                    min={4}
                    max={12}
                    step={0.5}
                    unit="mm"
                    onChange={(value) => update('subtitleTextSizeMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'subtitleWeight')}
                    value={params.subtitleFontWeightMm ?? 0}
                    min={0}
                    max={1.5}
                    step={0.1}
                    unit="mm"
                    onChange={(value) => update('subtitleFontWeightMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'subtitleSpacing')}
                    value={params.subtitleLetterSpacingMm ?? 0.5}
                    min={0}
                    max={4}
                    step={0.1}
                    unit="mm"
                    onChange={(value) => update('subtitleLetterSpacingMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'subtitleDepth')}
                    value={params.subtitleReliefDepthMm ?? 0.8}
                    min={0.4}
                    max={1.5}
                    step={0.1}
                    unit="mm"
                    onChange={(value) => update('subtitleReliefDepthMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'subtitleGap')}
                    value={params.subtitleGapMm ?? 1.5}
                    min={1.5}
                    max={8}
                    step={0.1}
                    unit="mm"
                    onChange={(value) => update('subtitleGapMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'subtitleOffsetX')}
                    value={params.subtitleOffsetXRatio * 100}
                    min={-100}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(value) => update('subtitleOffsetXRatio', value / 100)}
                  />
                  <RangeControl
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
        <ParameterGroupList
          locale={locale}
          params={params}
          showsParameter={showsParameter}
          update={update}
          renderParameter={renderParameter}
        />
        {isHeartSplit && (
          <div className="control-subsection heart-settings" data-testid="heart-settings">
            <h3>{t(locale, 'heartSettings')}</h3>
            <label className="select-control">
              <span>{t(locale, 'heartInterior')}</span>
              <select
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
          </div>
        )}
      </section>
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
    </aside>
  );
};
