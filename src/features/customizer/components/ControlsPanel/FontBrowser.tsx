import type { ReactNode } from 'react';

import { ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react';

import type { FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import type { useCustomizerParams } from '@/features/customizer/hooks/useCustomizerParams';
import type { FontTarget } from '@/features/customizer/model/font-browser';

import { FONT_CATEGORY_ORDER, type FontCategory } from '@/domain/keychain/fonts/catalog';
import { useFontBrowser } from '@/features/customizer/hooks/useFontBrowser';
import { t, type Locale } from '@/infrastructure/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { ResetIconButton } from '@/shared/ui/ResetIconButton';

type Props = {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  target: FontTarget;
  targetSwitch: ReactNode;
  favoriteFontCategories: FontCategory[];
  neutralSelection?: boolean;
  bootFrame?: boolean;
  resetActiveFont: () => void;
  resetActiveFontLabel: string;
  onFontProposed?: (fontId: string, target: FontTarget) => void;
  showReset?: boolean;
};

export const FontBrowser = ({
  locale,
  customizer,
  target,
  targetSwitch,
  favoriteFontCategories,
  neutralSelection = false,
  bootFrame = false,
  resetActiveFont,
  resetActiveFontLabel,
  onFontProposed,
  showReset = true,
}: Props) => {
  const { params, selectedFont, selectedSubtitleFont, usesCyrillic, fontNotice } = customizer;
  const activeFontTarget = target;
  const {
    fontSource,
    activateFontSource,
    activeBrowserState,
    updateFontBrowserState,
    visibleFonts,
    bootVisibleFonts,
    pageCount,
    currentPage,
    fileSystemPickerAvailable,
    restrictToFavorites,
    orderedFontCategories,
    openCategories,
    setOpenCategories,
    showAllFontCategories,
    setShowAllFontCategories,
    loadingFontId,
    previewFontId,
    setPreviewFontId,
    selectFont,
    loadGoogleFont,
    fontLoadError,
    activeTargetText,
    activeTargetFontId,
  } = useFontBrowser({ customizer, target, favoriteFontCategories, onFontProposed });
  const renderFontGroups = (fonts: typeof FONT_CATALOG) => (
    <div className="font-groups">
      {(!restrictToFavorites
        ? orderedFontCategories
        : orderedFontCategories.filter((category) => favoriteFontCategories.includes(category))
      ).map((category) => {
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
              <h4>{t(locale, `fontCategory${category.replace(/[^A-Za-z]/g, '')}`)}</h4>
            </summary>
            <div
              className={`font-grid ${params.templateId === 'articulated-name' ? 'articulated-font-grid' : ''}`}
            >
              {categoryFonts.map((font) => (
                <div className="font-card-wrap" key={font.id}>
                  <button
                    type="button"
                    className={`font-card ${!neutralSelection && activeTargetFontId === font.id ? 'selected' : ''} ${previewFontId === font.id ? 'previewing' : ''}`}
                    data-font-state={
                      loadingFontId === font.id
                        ? 'loading'
                        : !neutralSelection && activeTargetFontId === font.id
                          ? 'selected'
                          : 'idle'
                    }
                    onClick={() => void selectFont(font)}
                    disabled={loadingFontId !== undefined}
                    aria-busy={loadingFontId === font.id}
                    aria-pressed={!neutralSelection && activeTargetFontId === font.id}
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
                        : !neutralSelection && activeTargetFontId === font.id
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
      {!showAllFontCategories && favoriteFontCategories.length > 0 && (
        <button
          type="button"
          className="font-show-all"
          onClick={() => setShowAllFontCategories(true)}
        >
          {t(locale, 'fontShowAllCategories')}
        </button>
      )}
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
          motion="rotate"
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

  return (
    <div className="control-subsection" data-testid="font-browser">
      <div className="section-heading">
        <h3>
          {t(locale, 'font')}{' '}
          {!neutralSelection && (
            <span className="selected-note">
              {activeFontTarget === 'secondary' ? selectedSubtitleFont.name : selectedFont.name}
            </span>
          )}
        </h3>
        {showReset && <ResetIconButton label={resetActiveFontLabel} onClick={resetActiveFont} />}
      </div>
      {targetSwitch}
      <div className="font-source-tabs" role="tablist" aria-label={t(locale, 'fontSources')}>
        {(['bundled', 'google', 'local'] as const).map((source, index) => (
          <button
            type="button"
            data-candidate-key={activeFontTarget === 'secondary' ? 'subtitleFontId' : 'fontId'}
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
                motion="rotate"
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
                renderFontGroups(bootFrame ? bootVisibleFonts : visibleFonts)
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
                    motion="none"
                    disabled={currentPage === 1}
                    onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                  />
                  <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                  <IconButton
                    action="font-page-next"
                    icon={ChevronRight}
                    label={t(locale, 'next')}
                    motion="nudge"
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
              <p className="font-provider-state">
                {customizer.googleFonts.length === 0 && !activeBrowserState.search
                  ? t(locale, 'fontGoogleEmpty')
                  : t(locale, 'fontNoResults')}
              </p>
            ) : (
              renderFontGroups(bootFrame ? bootVisibleFonts : visibleFonts)
            )}
            {pageCount > 1 && (
              <nav className="font-pagination" aria-label={t(locale, 'fontPagination')}>
                <IconButton
                  action="font-page-previous"
                  icon={ChevronLeft}
                  label={t(locale, 'previous')}
                  motion="none"
                  disabled={currentPage === 1}
                  onClick={() => updateFontBrowserState({ page: activeBrowserState.page - 1 })}
                />
                <span>{t(locale, 'fontPage', { page: currentPage, pages: pageCount })}</span>
                <IconButton
                  action="font-page-next"
                  icon={ChevronRight}
                  label={t(locale, 'next')}
                  motion="nudge"
                  disabled={currentPage === pageCount}
                  onClick={() => updateFontBrowserState({ page: activeBrowserState.page + 1 })}
                />
              </nav>
            )}
          </>
        )}
      </div>
      {!bootFrame && (
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
      )}
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
    </div>
  );
};
