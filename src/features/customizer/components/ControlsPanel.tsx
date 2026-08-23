import {
  FONT_CATEGORY_ORDER,
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  TEMPLATE_CATALOG,
  PARAMETER_REGISTRY,
  MAGNET_POCKET_PRESETS,
  type ShapeParameter,
  type FontCategory,
} from '../../../domain/keychain';
import type { KeychainParams } from '../../../domain/keychain';
import {
  styleDescription,
  styleName,
  templateDescription,
  templateName,
  t,
  type Locale,
} from '../../../infrastructure/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ResetIconButton } from '../../../components/ResetIconButton';
import { type useCustomizerParams } from '../hooks/useCustomizerParams';
import { RangeControl } from './RangeControl';
import { DesignCardRail, DesignSelectCard } from './DesignSelectCard';
import { stylePreviewAsset, TEMPLATE_PREVIEW_ASSETS } from './design-card-assets';

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
  onNameEdited,
  onTemplateSelected,
}: {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  onReset: () => void;
  onNameEdited: () => void;
  onTemplateSelected: () => void;
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
    updateBackingSize,
    selectTemplate,
    resetSection,
    showsParameter,
    rangeFor,
  } = customizer;
  const [fontSource, setFontSource] = useState<FontSourceTab>('bundled');
  // This is intentionally session-local: selecting a target changes where the
  // browser applies a font, but is not part of the design document.
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
  const controlsRef = useRef<HTMLElement>(null);
  const [scrollState, setScrollState] = useState<'top' | 'middle' | 'bottom' | 'none'>('none');
  const fileSystemPickerAvailable =
    typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
  const fontsPerPage = 12;
  const activeBrowserState = fontBrowserState[fontSource];
  const hasSubtitle =
    TEMPLATE_CATALOG.find((template) => template.id === params.templateId)?.supportsSubtitle ===
    true;
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

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    const updateScrollState = (): void => {
      const atTop = controls.scrollTop <= 1;
      const atBottom = controls.scrollHeight - controls.clientHeight - controls.scrollTop <= 1;
      setScrollState(
        controls.scrollHeight <= controls.clientHeight
          ? 'none'
          : atTop
            ? 'top'
            : atBottom
              ? 'bottom'
              : 'middle',
      );
    };
    updateScrollState();
    controls.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      controls.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);
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
        <button
          type="button"
          className="font-filter-clear"
          disabled={
            activeBrowserState.category === 'all' &&
            activeBrowserState.search === '' &&
            activeBrowserState.supportsTextOnly
          }
          onClick={() =>
            updateFontBrowserState({ search: '', category: 'all', supportsTextOnly: true, page: 1 })
          }
        >
          {t(locale, 'clearFontFilters')}
        </button>
      </div>
    </details>
  );

  const parameterGroups: readonly { key: string; parameters: readonly ShapeParameter[] }[] = [
    {
      key: 'core',
      parameters: ['baseThicknessMm', 'edgeInsetMm', 'holeDiameterMm'],
    },
    {
      key: 'style',
      parameters: [
        'cornerRadiusMm',
        'nameplateTiltDeg',
        'nameplateEmbedMm',
        'stakeLengthMm',
        'reliefHaloMm',
        'ringOffsetMm',
        'bubbleLobeMm',
        'tagTailMm',
        'archCurveMm',
        'stakeShoulderMm',
        'ribbonTailMm',
        'ribbonNotchMm',
      ],
    },
    {
      key: 'mechanical',
      parameters: [
        'connectorWidthMm',
        'jointClearanceMm',
        'mechanicalGapMm',
        'maxJointAngleDeg',
        'jointBossMm',
      ],
    },
  ];

  const parameterLabel = (parameter: ShapeParameter): string => {
    if (parameter === 'baseThicknessMm')
      return t(locale, params.templateId === 'nameplate' ? 'plateThickness' : 'baseThickness');
    if (parameter === 'reliefDepthMm')
      return t(locale, params.templateId === 'nameplate' ? 'textLift' : 'raisedText');
    if (parameter === 'edgeInsetMm') return t(locale, 'backingSize');
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
        onChange={(value) =>
          parameter === 'edgeInsetMm' ? updateBackingSize(value) : update(key, value as never)
        }
      />
    );
  };

  return (
    <aside
      ref={controlsRef}
      className="controls-panel"
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
      <section className="control-section" data-testid="name-settings">
        <div className="section-heading">
          <h2>{t(locale, 'name')}</h2>
          <ResetIconButton label={t(locale, 'resetName')} onClick={() => resetSection('name')} />
        </div>
        <label className="text-input" data-guide-target="name">
          <span className="sr-only">{t(locale, 'nameInput')}</span>
          <input
            aria-label={t(locale, 'nameInput')}
            value={params.text}
            maxLength={24}
            onChange={(event) => {
              onNameEdited();
              updateText(event.target.value);
            }}
            placeholder={t(locale, 'namePlaceholder')}
          />
        </label>
        {hasSubtitle && (
          <label className="text-input subtitle-input-control" data-testid="subtitle-input">
            <span className="sr-only">{t(locale, 'subtitleInput')}</span>
            <input
              className="subtitle-input"
              aria-label={t(locale, 'subtitleInput')}
              value={params.subtitle}
              maxLength={24}
              onChange={(event) => {
                onNameEdited();
                if (!event.target.value.trim()) setFontTarget('primary');
                updateSubtitle(event.target.value);
              }}
              placeholder={t(locale, 'subtitlePlaceholder')}
            />
          </label>
        )}
      </section>
      <section
        className="control-section"
        data-guide-target="shape"
        data-testid="template-settings"
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
                onTemplateSelected();
                if (!template.supportsSubtitle) setFontTarget('primary');
                selectTemplate(template.id);
              }}
            />
          ))}
        </DesignCardRail>
      </section>
      {availableStyles.length > 0 && (
        <section className="control-section">
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
        </section>
      )}
      {params.templateId === 'magnet' && (
        <section className="control-section magnet-controls">
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
                  {preset.id} mm
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
      <section className="control-section" data-testid="font-browser">
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
                <button type="button" onClick={() => void customizer.loadGoogleFonts()}>
                  {t(locale, 'retry')}
                </button>
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
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                    >
                      {t(locale, 'previous')}
                    </button>
                    <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                    <button
                      type="button"
                      disabled={currentPage === pageCount}
                      onClick={() => updateFontBrowserState({ page: activeBrowserState.page + 1 })}
                    >
                      {t(locale, 'next')}
                    </button>
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
                        ⓘ
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
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                  >
                    {t(locale, 'previous')}
                  </button>
                  <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => updateFontBrowserState({ page: activeBrowserState.page + 1 })}
                  >
                    {t(locale, 'next')}
                  </button>
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
      <section className="control-section shape-settings" data-testid="shape-settings">
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
        <div className="control-subsection shape-figure-settings" data-testid="figure-settings">
          <h3>{t(locale, 'figureSettings')}</h3>
          {parameterGroups.map((group) => {
            const controls = group.parameters.map(renderParameter).filter(Boolean);
            if (!controls.length && group.key !== 'core') return null;
            return (
              <div className="parameter-group" data-parameter-group={group.key} key={group.key}>
                <h4>
                  {t(locale, `parameterGroup${group.key[0].toUpperCase()}${group.key.slice(1)}`)}
                </h4>
                <div className="range-grid">{controls}</div>
              </div>
            );
          })}
          {showsParameter('plantAccentEnabled') && (
            <label className="check-control">
              <input
                type="checkbox"
                checked={params.plantAccentEnabled}
                onChange={(event) => update('plantAccentEnabled', event.target.checked)}
              />
              <span>{t(locale, 'plantAccents')}</span>
            </label>
          )}
        </div>
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
