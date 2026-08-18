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
  templateName,
  t,
  type Locale,
} from '../../../infrastructure/i18n';
import { useMemo, useState } from 'react';
import { ResetIconButton } from '../../../components/ResetIconButton';
import { type useCustomizerParams } from '../hooks/useCustomizerParams';
import { RangeControl } from './RangeControl';

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
  const [fontSource, setFontSource] = useState<'local' | 'google'>('local');
  const [fontSearch, setFontSearch] = useState('');
  const [fontPage, setFontPage] = useState(1);
  const [fontLoadError, setFontLoadError] = useState(false);
  const [loadingFontId, setLoadingFontId] = useState<string>();
  const [fontCategory, setFontCategory] = useState<FontCategory | 'all'>('all');
  const [supportsTextOnly, setSupportsTextOnly] = useState(true);
  const fontsPerPage = 12;
  const sourceFonts = fontSource === 'google' ? customizer.googleFonts : FONT_CATALOG;
  const compatibleFonts = useMemo(
    () =>
      sourceFonts.filter((font) =>
        params.templateId === 'articulated-name'
          ? fontSupportsArticulatedName(font, params.text)
          : !supportsTextOnly || fontSupportsText(font, params.text),
      ),
    [params.templateId, params.text, sourceFonts, supportsTextOnly],
  );
  const filteredFonts = useMemo(() => {
    const query = fontSearch.trim().toLocaleLowerCase();
    return compatibleFonts.filter(
      (font) =>
        (fontCategory === 'all' || font.category === fontCategory) &&
        (!query ||
          font.name.toLocaleLowerCase().includes(query) ||
          font.category.toLocaleLowerCase().includes(query)),
    );
  }, [compatibleFonts, fontCategory, fontSearch]);
  const pageCount = Math.max(1, Math.ceil(filteredFonts.length / fontsPerPage));
  const currentPage = Math.min(fontPage, pageCount);
  const visibleFonts = filteredFonts.slice(
    (currentPage - 1) * fontsPerPage,
    currentPage * fontsPerPage,
  );
  const selectFont = async (font: (typeof FONT_CATALOG)[number]): Promise<void> => {
    setFontLoadError(false);
    setLoadingFontId(font.id);
    if (font.source === 'google' && typeof FontFace !== 'undefined') {
      try {
        const face = new FontFace(font.previewFamily, `url(${font.file})`, {
          weight: String(font.weight),
        });
        await face.load();
        document.fonts.add(face);
      } catch {
        setFontLoadError(true);
        setLoadingFontId(undefined);
        return;
      }
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
          <div className="font-group" key={category}>
            <h3>{t(locale, `fontCategory${category.replace(/[^A-Za-z]/g, '')}`)}</h3>
            <div
              className={`font-grid ${params.templateId === 'articulated-name' ? 'articulated-font-grid' : ''}`}
            >
              {categoryFonts.map((font) => (
                <div className="font-card-wrap" key={font.id}>
                  <button
                    type="button"
                    className={`font-card ${params.fontId === font.id ? 'selected' : ''}`}
                    onClick={() => void selectFont(font)}
                    disabled={loadingFontId !== undefined}
                    aria-busy={loadingFontId === font.id}
                    title={font.name}
                  >
                    <span style={{ fontFamily: font.previewFamily, fontWeight: font.weight }}>
                      {params.text || (usesCyrillic ? font.sampleCyrillic : font.sampleLatin)}
                    </span>
                    <small>
                      {loadingFontId === font.id ? t(locale, 'fontLoading') : font.name}
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
          </div>
        );
      })}
    </div>
  );
  const fontFilters = (
    <div className="font-filter-row">
      <label>
        <span>{t(locale, 'fontCategoryFilter')}</span>
        <select
          value={fontCategory}
          onChange={(event) => {
            setFontCategory(event.target.value as FontCategory | 'all');
            setFontPage(1);
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
            checked={supportsTextOnly}
            onChange={(event) => {
              setSupportsTextOnly(event.target.checked);
              setFontPage(1);
            }}
          />
          <span>{t(locale, 'fontSupportsText')}</span>
        </label>
      )}
    </div>
  );

  return (
    <aside className="controls-panel">
      <section className="control-section">
        <div className="section-heading">
          <h2>{t(locale, 'name')}</h2>
          <ResetIconButton label={t(locale, 'resetName')} onClick={() => resetSection('name')} />
        </div>
        <label className="text-input" data-guide-target="name">
          <span className="sr-only">Name or text</span>
          <input
            aria-label="Name or text"
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
      <section className="control-section">
        <div className="section-heading">
          <h2>{t(locale, 'template')}</h2>
          <ResetIconButton
            label={t(locale, 'resetTemplate')}
            onClick={() => resetSection('template')}
          />
        </div>
        <div className="card-grid template-grid" data-guide-target="shape">
          {TEMPLATE_CATALOG.map((template) => (
            <button
              type="button"
              key={template.id}
              className={`choice-card ${params.templateId === template.id ? 'selected' : ''}`}
              data-guide-target={params.templateId === template.id ? 'shape-control' : undefined}
              onClick={() => {
                onTemplateSelected();
                selectTemplate(template.id);
              }}
            >
              <span className={`style-swatch template-${template.id}`} />
              <strong>{templateName(locale, template.id, template.name)}</strong>
            </button>
          ))}
        </div>
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
          <div className="card-grid">
            {availableStyles.map((style) => (
              <button
                type="button"
                key={style.id}
                className={`choice-card ${params.styleId === style.id ? 'selected' : ''}`}
                onClick={() => update('styleId', style.id as KeychainParams['styleId'])}
              >
                <span className={`style-swatch style-${style.id}`} />
                <span className="choice-card-copy">
                  <strong>{styleName(locale, style.id, style.name)}</strong>
                  <small>{styleDescription(locale, style.id, style.description)}</small>
                </span>
              </button>
            ))}
          </div>
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
          {(['local', 'google'] as const).map((source) => (
            <button
              type="button"
              role="tab"
              aria-selected={fontSource === source}
              className={fontSource === source ? 'active' : ''}
              key={source}
              onClick={() => {
                setFontSource(source);
                setFontPage(1);
                if (
                  source === 'google' &&
                  !customizer.googleFonts.length &&
                  !customizer.googleError
                )
                  void customizer.loadGoogleFonts();
              }}
            >
              {t(locale, source === 'local' ? 'fontSourceLocal' : 'fontSourceGoogle')}
            </button>
          ))}
        </div>
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
                  value={fontSearch}
                  onChange={(event) => setFontSearch(event.target.value)}
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
                <p className="font-provider-state">{t(locale, 'fontNoResults')}</p>
              )}
              {pageCount > 1 && (
                <nav className="font-pagination" aria-label={t(locale, 'fontPagination')}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setFontPage((page) => page - 1)}
                  >
                    {t(locale, 'previous')}
                  </button>
                  <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setFontPage((page) => page + 1)}
                  >
                    {t(locale, 'next')}
                  </button>
                </nav>
              )}
            </>
          )
        ) : (
          <>
            <label className="font-search">
              <span className="sr-only">{t(locale, 'fontSearch')}</span>
              <input
                type="search"
                value={fontSearch}
                onChange={(event) => {
                  setFontSearch(event.target.value);
                  setFontPage(1);
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
                  onClick={() => setFontPage((page) => page - 1)}
                >
                  {t(locale, 'previous')}
                </button>
                <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setFontPage((page) => page + 1)}
                >
                  {t(locale, 'next')}
                </button>
              </nav>
            )}
          </>
        )}
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
          {showsParameter('textHeightMm') && (
            <RangeControl
              label={t(locale, 'nameHeight')}
              value={params.textHeightMm}
              {...rangeFor('textHeightMm')}
              onChange={(value) => update('textHeightMm', value)}
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
        </div>
      </section>
      <button type="button" className="reset-settings" onClick={onReset}>
        {t(locale, 'resetSettings')}
      </button>
      <div className="controls-scroll-spacer" aria-hidden="true" />
    </aside>
  );
};
