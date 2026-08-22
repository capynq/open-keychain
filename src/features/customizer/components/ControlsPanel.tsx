import {
  FONT_CATEGORY_ORDER,
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  TEMPLATE_CATALOG,
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
    availableStyles,
    usesCyrillic,
    fontNotice,
    update,
    updateText,
    updateBackingSize,
    selectTemplate,
    resetSection,
    showsParameter,
    rangeFor,
  } = customizer;
  const [fontSource, setFontSource] = useState<FontSourceTab>('bundled');
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
  const sourceFonts =
    fontSource === 'google'
      ? customizer.googleFonts
      : fontSource === 'local'
        ? customizer.localFonts.flatMap((record) => (record.font ? [record.font] : []))
        : FONT_CATALOG;
  const compatibleFonts = useMemo(
    () =>
      sourceFonts.filter((font) =>
        params.templateId === 'articulated-name'
          ? fontSupportsArticulatedName(font, params.text)
          : !activeBrowserState.supportsTextOnly || fontSupportsText(font, params.text),
      ),
    [activeBrowserState.supportsTextOnly, params.templateId, params.text, sourceFonts],
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
    update('fontId', font.id);
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
                    className={`font-card ${params.fontId === font.id ? 'selected' : ''} ${previewFontId === font.id ? 'previewing' : ''}`}
                    data-font-state={
                      loadingFontId === font.id
                        ? 'loading'
                        : params.fontId === font.id
                          ? 'selected'
                          : 'idle'
                    }
                    onClick={() => void selectFont(font)}
                    disabled={loadingFontId !== undefined}
                    aria-busy={loadingFontId === font.id}
                    aria-pressed={params.fontId === font.id}
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
                      {params.text || (usesCyrillic ? font.sampleCyrillic : font.sampleLatin)}
                    </span>
                    <small>
                      {loadingFontId === font.id
                        ? t(locale, 'fontLoading')
                        : params.fontId === font.id
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
      <section className="control-section">
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
      </section>
      <section className="control-section" data-guide-target="shape">
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
      <section className="control-section">
        <div className="section-heading">
          <h2>
            {t(locale, 'font')} <span className="selected-note">{selectedFont.name}</span>
          </h2>
          <ResetIconButton label={t(locale, 'resetFont')} onClick={() => resetSection('font')} />
        </div>
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
            {t(locale, fontNotice.articulated ? 'fontArticulatedFallback' : 'fontFallback', {
              font: fontNotice.font,
              replacement: fontNotice.replacement,
            })}
          </p>
        )}
        {fontLoadError && (
          <p className="font-notice" role="alert">
            {t(locale, 'fontRuntimeLoadFailed')}
          </p>
        )}
      </section>
      <section className="control-section">
        <div className="section-heading">
          <h2>{t(locale, 'shape')}</h2>
          <ResetIconButton label={t(locale, 'resetShape')} onClick={() => resetSection('shape')} />
        </div>
        <div className="range-grid">
          {showsParameter('textSizeMm') && (
            <RangeControl
              label={t(locale, 'textSize')}
              value={params.textSizeMm}
              {...rangeFor('textSizeMm')}
              onChange={(value) => update('textSizeMm', value)}
            />
          )}
          {showsParameter('fontWeightMm') && (
            <RangeControl
              label={t(locale, 'fontWeight')}
              value={params.fontWeightMm}
              {...rangeFor('fontWeightMm')}
              onChange={(value) => update('fontWeightMm', value)}
            />
          )}
          {showsParameter('baseThicknessMm') && (
            <RangeControl
              label={t(
                locale,
                params.templateId === 'nameplate' ? 'plateThickness' : 'baseThickness',
              )}
              value={params.baseThicknessMm}
              {...rangeFor('baseThicknessMm')}
              onChange={(value) => update('baseThicknessMm', value)}
            />
          )}
          {showsParameter('reliefDepthMm') && (
            <RangeControl
              label={t(locale, params.templateId === 'nameplate' ? 'textLift' : 'raisedText')}
              value={params.reliefDepthMm}
              {...rangeFor('reliefDepthMm')}
              onChange={(value) => update('reliefDepthMm', value)}
            />
          )}
          {showsParameter('edgeInsetMm') && (
            <RangeControl
              label={t(locale, 'backingSize')}
              value={params.edgeInsetMm}
              {...{ ...rangeFor('edgeInsetMm'), min: 1.2 }}
              onChange={updateBackingSize}
            />
          )}
          {showsParameter('letterSpacingMm') && (
            <RangeControl
              label={t(locale, 'letterSpacing')}
              value={params.letterSpacingMm}
              {...rangeFor('letterSpacingMm')}
              onChange={(value) => update('letterSpacingMm', value)}
            />
          )}
          {showsParameter('holeDiameterMm') && (
            <RangeControl
              label={t(locale, 'keyringHole')}
              value={params.holeDiameterMm}
              {...rangeFor('holeDiameterMm')}
              onChange={(value) => update('holeDiameterMm', value)}
            />
          )}
          {showsParameter('connectorWidthMm') && (
            <>
              <RangeControl
                label={t(locale, 'connectorWidth')}
                value={params.connectorWidthMm}
                {...rangeFor('connectorWidthMm')}
                onChange={(value) => update('connectorWidthMm', value)}
              />
              <RangeControl
                label={t(locale, 'jointClearance')}
                value={params.jointClearanceMm}
                {...rangeFor('jointClearanceMm')}
                onChange={(value) => update('jointClearanceMm', value)}
              />
              <RangeControl
                label={t(locale, 'mechanicalGap')}
                value={params.mechanicalGapMm}
                {...rangeFor('mechanicalGapMm')}
                onChange={(value) => update('mechanicalGapMm', value)}
              />
              <RangeControl
                label={t(locale, 'maxJointAngle')}
                value={params.maxJointAngleDeg}
                {...rangeFor('maxJointAngleDeg')}
                onChange={(value) => update('maxJointAngleDeg', value)}
              />
            </>
          )}
          {showsParameter('cornerRadiusMm') && (
            <RangeControl
              label={t(locale, 'cornerRadius')}
              value={params.cornerRadiusMm}
              {...rangeFor('cornerRadiusMm')}
              onChange={(value) => update('cornerRadiusMm', value)}
            />
          )}
          {showsParameter('nameplateTiltDeg') && (
            <RangeControl
              label={t(locale, 'textTilt')}
              value={params.nameplateTiltDeg}
              {...rangeFor('nameplateTiltDeg')}
              onChange={(value) => update('nameplateTiltDeg', value)}
            />
          )}
          {showsParameter('nameplateEmbedMm') && (
            <RangeControl
              label={t(locale, 'embedDepth')}
              value={params.nameplateEmbedMm}
              {...rangeFor('nameplateEmbedMm')}
              onChange={(value) => update('nameplateEmbedMm', value)}
            />
          )}
          {showsParameter('stakeLengthMm') && (
            <RangeControl
              label={t(locale, 'stakeLength')}
              value={params.stakeLengthMm}
              {...rangeFor('stakeLengthMm')}
              onChange={(value) => update('stakeLengthMm', value)}
            />
          )}
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
          {showsParameter('reliefHaloMm') && (
            <RangeControl
              label={t(locale, 'reliefHalo')}
              value={params.reliefHaloMm}
              {...rangeFor('reliefHaloMm')}
              onChange={(value) => update('reliefHaloMm', value)}
            />
          )}
          {showsParameter('ringOffsetMm') && (
            <RangeControl
              label={t(locale, 'ringOffset')}
              value={params.ringOffsetMm}
              {...rangeFor('ringOffsetMm')}
              onChange={(value) => update('ringOffsetMm', value)}
            />
          )}
          {showsParameter('bubbleLobeMm') && (
            <RangeControl
              label={t(locale, 'bubbleLobe')}
              value={params.bubbleLobeMm}
              {...rangeFor('bubbleLobeMm')}
              onChange={(value) => update('bubbleLobeMm', value)}
            />
          )}
          {showsParameter('tagTailMm') && (
            <RangeControl
              label={t(locale, 'tagTail')}
              value={params.tagTailMm}
              {...rangeFor('tagTailMm')}
              onChange={(value) => update('tagTailMm', value)}
            />
          )}
          {showsParameter('archCurveMm') && (
            <RangeControl
              label={t(locale, 'archCurve')}
              value={params.archCurveMm}
              {...rangeFor('archCurveMm')}
              onChange={(value) => update('archCurveMm', value)}
            />
          )}
          {showsParameter('stakeShoulderMm') && (
            <RangeControl
              label={t(locale, 'stakeShoulder')}
              value={params.stakeShoulderMm}
              {...rangeFor('stakeShoulderMm')}
              onChange={(value) => update('stakeShoulderMm', value)}
            />
          )}
          {showsParameter('jointBossMm') && (
            <RangeControl
              label={t(locale, 'jointBoss')}
              value={params.jointBossMm}
              {...rangeFor('jointBossMm')}
              onChange={(value) => update('jointBossMm', value)}
            />
          )}
        </div>
      </section>
      <button type="button" className="reset-settings" onClick={onReset}>
        {t(locale, 'resetSettings')}
      </button>
      <div className="controls-scroll-spacer" aria-hidden="true" />
    </aside>
  );
};
