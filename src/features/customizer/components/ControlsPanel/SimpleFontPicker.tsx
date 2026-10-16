import { Plus } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import type { FontDefinition } from '@/domain/keychain/fonts/catalog';
import type { KeychainParams } from '@/domain/keychain/model/types';
import type { useFontSuggestions } from '@/features/customizer/hooks/useFontSuggestions';
import type { Locale } from '@/infrastructure/i18n';

import { useFontPreviewLoader } from '@/features/customizer/hooks/useFontPreviewLoader';
import { t } from '@/infrastructure/i18n';

import carouselStyles from './SimpleFontCarousel.module.css';
import styles from './SimpleOptions.module.css';

export const SimpleFontPicker = ({
  locale,
  params,
  selectedName,
  suggestions,
  neutralSelection = false,
  target,
  onSelect,
  onMore,
}: {
  locale: Locale;
  params: KeychainParams;
  selectedName: string;
  suggestions: ReturnType<typeof useFontSuggestions>;
  neutralSelection?: boolean;
  target: 'primary' | 'secondary';
  onSelect: (fontId: string) => void;
  onMore: () => void;
}) => {
  const name = useId();
  const text = target === 'secondary' ? params.subtitle : params.text;
  const selectedId = neutralSelection
    ? undefined
    : target === 'secondary'
      ? params.subtitleFontId
      : params.fontId;
  const pagesRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(suggestions.page);
  const animatedNavigationRef = useRef(0);
  const { loadFont } = useFontPreviewLoader();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const selectionVersion = useRef(0);
  const mounted = useRef(false);
  const discoveryFocusRef = useRef<number | undefined>(undefined);
  const contextKey = JSON.stringify([target, params.templateId, text]);
  const [loadingSelection, setLoadingSelection] = useState<{
    id: string;
    context: string;
    version: number;
  }>();
  const [selectionErrorContext, setSelectionErrorContext] = useState<string>();
  const loadingFontId = loadingSelection?.context === contextKey ? loadingSelection.id : undefined;
  const selectionError = selectionErrorContext === contextKey;
  const [loadedPreviews, setLoadedPreviews] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    mounted.current = true;
    selectionVersion.current += 1;
    discoveryFocusRef.current = undefined;
    return () => {
      mounted.current = false;
      selectionVersion.current += 1;
    };
  }, [target, text, params.templateId]);

  const selectFont = async (font: FontDefinition): Promise<void> => {
    const version = ++selectionVersion.current;
    setLoadingSelection({ id: font.id, context: contextKey, version });
    setSelectionErrorContext(undefined);
    const loaded = await loadFont(font);
    if (version !== selectionVersion.current) {
      if (mounted.current)
        setLoadingSelection((current) => (current?.version === version ? undefined : current));
      return;
    }
    setLoadingSelection(undefined);
    if (!loaded) {
      setSelectionErrorContext(contextKey);
      return;
    }
    onSelect(font.id);
  };

  useLayoutEffect(() => {
    if (discoveryFocusRef.current === undefined) return;
    const appended = suggestions.pageFonts.length > discoveryFocusRef.current;
    if (!appended && !suggestions.exhausted) return;
    discoveryFocusRef.current = undefined;
    const field =
      pagesRef.current?.children[suggestions.page - 1]?.querySelector<HTMLInputElement>('input');
    (field ?? moreButtonRef.current)?.focus({ preventScroll: true });
  }, [suggestions.page, suggestions.pageFonts, suggestions.exhausted]);

  useEffect(() => {
    let active = true;
    const fonts = [suggestions.page - 1, suggestions.page]
      .flatMap((index) => suggestions.pageFonts[index] ?? [])
      .filter((font) => font.source !== 'bundled');
    void Promise.all(
      fonts.map(async (font) => {
        if ((await loadFont(font)) && active)
          setLoadedPreviews((current) => new Set(current).add(font.id));
      }),
    );
    return () => {
      active = false;
    };
  }, [loadFont, suggestions.page, suggestions.pageFonts]);

  useLayoutEffect(() => {
    currentPageRef.current = suggestions.page;
  }, [suggestions.page]);

  useLayoutEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    const batch = suggestions.revealBatch;
    const newlyAppended =
      batch &&
      batch.revision !== animatedNavigationRef.current &&
      currentPageRef.current === batch.firstPage + 1;
    if (batch) animatedNavigationRef.current = batch.revision;
    pages.scrollTo({
      left: pages.clientWidth * (currentPageRef.current - 1),
      behavior:
        newlyAppended && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'auto',
    });
  }, [suggestions.pageFonts, suggestions.revealBatch]);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages || typeof ResizeObserver === 'undefined') return;
    let previousWidth = pages.clientWidth;
    const observer = new ResizeObserver(() => {
      if (pages.clientWidth === previousWidth) return;
      previousWidth = pages.clientWidth;
      pages.scrollTo({ left: pages.clientWidth * (currentPageRef.current - 1), behavior: 'auto' });
    });
    observer.observe(pages);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (): void => {
    const pages = pagesRef.current;
    if (!pages || pages.clientWidth === 0) return;
    suggestions.goToPage(Math.round(pages.scrollLeft / pages.clientWidth));
  };

  const handlePageClick = (pageIndex: number): void => {
    const pages = pagesRef.current;
    suggestions.goToPage(pageIndex);
    pages?.scrollTo({
      left: (pages.clientWidth || 0) * pageIndex,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <fieldset className={styles.picker} data-testid="simple-font-picker">
      <legend>
        {t(locale, 'font')}
        {!neutralSelection &&
          !suggestions.pageFonts.flat().some((font) => font.id === selectedId) && (
            <span className={styles.custom}>{selectedName}</span>
          )}
      </legend>
      <div className={carouselStyles.viewport}>
        <div className={carouselStyles.pages} ref={pagesRef} onScroll={handleScroll}>
          {suggestions.carouselPages.map(({ fonts: pageFonts, discovery }, pageIndex) => (
            <div
              className={carouselStyles.page}
              key={pageIndex}
              role="group"
              aria-label={t(locale, 'simpleSuggestionSet', {
                page: pageIndex + 1,
                pages: suggestions.pages,
              })}
            >
              <div className={styles.fontChoices}>
                {pageFonts.map((font) => (
                  <label
                    className={`${styles.choice} ${styles.fontChoice}${suggestions.revealBatch?.fontIds.includes(font.id) ? ` ${carouselStyles.revealCard}` : ''}`}
                    style={
                      suggestions.revealBatch?.fontIds.includes(font.id)
                        ? {
                            animationDelay: `calc(${suggestions.revealBatch.fontIds.indexOf(font.id)} * var(--workshop-motion-stagger))`,
                          }
                        : undefined
                    }
                    key={font.id}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={font.id}
                      checked={!neutralSelection && selectedId === font.id}
                      data-candidate-key={target === 'secondary' ? 'subtitleFontId' : 'fontId'}
                      disabled={loadingFontId !== undefined}
                      aria-busy={loadingFontId === font.id}
                      onChange={() => void selectFont(font)}
                    />
                    <span
                      className={styles.fontSpecimen}
                      style={{
                        fontFamily:
                          font.source === 'bundled' || loadedPreviews.has(font.id)
                            ? font.previewFamily
                            : undefined,
                        fontWeight: font.weight,
                      }}
                      aria-hidden="true"
                    >
                      {font.scripts.includes('cyrillic') && /[\u0400-\u04ff]/u.test(text)
                        ? 'Аа'
                        : 'Aa'}
                    </span>
                    <span className={styles.choiceCopy}>
                      <strong>{font.name}</strong>
                      <small>
                        {loadingFontId === font.id
                          ? t(locale, 'fontLoading')
                          : t(locale, `fontCategory${font.category.replace(/[^A-Za-z]/g, '')}`)}
                      </small>
                    </span>
                  </label>
                ))}
                {discovery && (
                  <button
                    type="button"
                    className={`${styles.choice} ${styles.fontChoice} ${carouselStyles.actionCard}`}
                    disabled={suggestions.isLoading}
                    aria-busy={suggestions.isLoading}
                    data-icon-motion="none"
                    onClick={() => {
                      discoveryFocusRef.current = suggestions.pageFonts.length;
                      void suggestions.loadMore();
                    }}
                  >
                    <span
                      className={`${styles.fontSpecimen} ${carouselStyles.actionIcon}`}
                      aria-hidden="true"
                    >
                      <Plus size={28} />
                    </span>
                    <span className={styles.choiceCopy}>
                      <strong>
                        {t(locale, suggestions.isLoading ? 'fontLoading' : 'simpleMoreFontsTitle')}
                      </strong>
                      <small>{t(locale, 'simpleLoadFontStyles')}</small>
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className={carouselStyles.dots}
        aria-label={t(locale, 'simpleSuggestionSet', {
          page: suggestions.page,
          pages: suggestions.pages,
        })}
      >
        {Array.from({ length: suggestions.pages }, (_, pageIndex) => (
          <button
            type="button"
            key={pageIndex}
            className={`${carouselStyles.dot}${suggestions.revealBatch && pageIndex >= suggestions.revealBatch.firstDot ? ` ${carouselStyles.revealDot}` : ''}`}
            style={
              suggestions.revealBatch && pageIndex >= suggestions.revealBatch.firstDot
                ? {
                    animationDelay: `calc(${pageIndex - suggestions.revealBatch.firstDot} * var(--workshop-motion-page-step))`,
                  }
                : undefined
            }
            aria-label={t(locale, 'simpleSuggestionSet', {
              page: pageIndex + 1,
              pages: suggestions.pages,
            })}
            aria-current={pageIndex === suggestions.page - 1 ? 'page' : undefined}
            onClick={() => handlePageClick(pageIndex)}
          />
        ))}
      </div>
      {selectionError && (
        <p className={carouselStyles.error} role="alert">
          {t(locale, 'fontRuntimeLoadFailed')}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {t(
          locale,
          suggestions.isLoading
            ? 'simpleMoreFontsLoading'
            : suggestions.pages
              ? 'simpleSuggestionSet'
              : 'fontNoResults',
          {
            page: suggestions.page,
            pages: suggestions.pages,
          },
        )}
      </span>
      <button ref={moreButtonRef} type="button" className={styles.more} onClick={onMore}>
        {t(locale, 'simpleFindFont')}
      </button>
    </fieldset>
  );
};
