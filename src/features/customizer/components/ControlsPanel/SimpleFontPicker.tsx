import { Plus } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import type { FontDefinition } from '@/domain/keychain/fonts/catalog';
import type { KeychainParams } from '@/domain/keychain/model/types';
import type { useFontSuggestions } from '@/features/customizer/hooks/useFontSuggestions';
import type { Locale } from '@/infrastructure/i18n';
import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { useDiscoveryMotion } from '@/features/customizer/hooks/useDiscoveryMotion';
import { useFontPreviewLoader } from '@/features/customizer/hooks/useFontPreviewLoader';
import { recoveryMessage, recoverySteps, t } from '@/infrastructure/i18n';
import { activationMotion, navigationMotion, type MotionIntent } from '@/shared/lib/motion';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

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
  const { loadFont, loadFontWithFailure } = useFontPreviewLoader();
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
  const [selectionFailure, setSelectionFailure] = useState<RecoveryFailure>();
  const [selectionFailureFontId, setSelectionFailureFontId] = useState<string>();
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
    setSelectionFailure(undefined);
    setSelectionFailureFontId(undefined);
    setSelectionErrorContext(undefined);
    const loaded = await loadFontWithFailure(font);
    if (version !== selectionVersion.current) {
      if (mounted.current)
        setLoadingSelection((current) => (current?.version === version ? undefined : current));
      return;
    }
    setLoadingSelection(undefined);
    if (!loaded.ok) {
      setSelectionFailure(loaded.failure);
      setSelectionFailureFontId(font.id);
      setSelectionErrorContext(contextKey);
      return;
    }
    onSelect(font.id);
  };

  const { beginDiscovery, focusAfterDiscovery } = useDiscoveryMotion(
    pagesRef,
    suggestions.revealBatch,
    suggestions.page,
    contextKey,
  );

  useLayoutEffect(() => {
    if (discoveryFocusRef.current === undefined) return;
    const appended = suggestions.pageFonts.length > discoveryFocusRef.current;
    if (!appended && !suggestions.exhausted) return;
    discoveryFocusRef.current = undefined;
    const field =
      pagesRef.current?.children[suggestions.page - 1]?.querySelector<HTMLInputElement>('input');
    focusAfterDiscovery(field ?? moreButtonRef.current);
  }, [suggestions.page, suggestions.pageFonts, suggestions.exhausted, focusAfterDiscovery]);

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
    pages.scrollTo({
      left: pages.clientWidth * (currentPageRef.current - 1),
      behavior: 'instant',
    });
  }, [suggestions.pageFonts, suggestions.revealBatch]);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages || typeof ResizeObserver === 'undefined') return;
    let previousWidth = pages.clientWidth;
    const observer = new ResizeObserver(() => {
      if (pages.clientWidth === previousWidth) return;
      previousWidth = pages.clientWidth;
      pages.scrollTo({
        left: pages.clientWidth * (currentPageRef.current - 1),
        behavior: 'instant',
      });
    });
    observer.observe(pages);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (): void => {
    const pages = pagesRef.current;
    if (!pages || pages.clientWidth === 0) return;
    suggestions.goToPage(Math.round(pages.scrollLeft / pages.clientWidth));
  };

  const handlePageClick = (pageIndex: number, intent: MotionIntent): void => {
    const pages = pagesRef.current;
    beginDiscovery('instant');
    suggestions.goToPage(pageIndex);
    pages?.scrollTo({
      left: (pages.clientWidth || 0) * pageIndex,
      behavior: navigationMotion(intent),
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
                    className={`${styles.choice} ${styles.fontChoice}`}
                    data-font-id={font.id}
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
                    onClick={(event) => {
                      beginDiscovery(activationMotion(event));
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
        role="group"
        aria-label={t(locale, 'fontPagesNavigation')}
      >
        {Array.from({ length: suggestions.pages }, (_, pageIndex) => (
          <button
            type="button"
            key={pageIndex}
            className={carouselStyles.dot}
            aria-label={t(locale, 'simpleSuggestionSet', {
              page: pageIndex + 1,
              pages: suggestions.pages,
            })}
            aria-current={pageIndex === suggestions.page - 1 ? 'page' : undefined}
            onClick={(event) => handlePageClick(pageIndex, activationMotion(event))}
          />
        ))}
      </div>
      {selectionError && selectionFailure && (
        <RecoveryNotice
          role="alert"
          className={carouselStyles.error}
          message={recoveryMessage(locale, selectionFailure)}
          detailsLabel={t(locale, 'recoveryDetails')}
          diagnostic={selectionFailure.message}
          steps={recoverySteps(locale, selectionFailure)}
          actions={[
            {
              id: 'retry-font-preview',
              label: t(locale, 'recoveryRetry'),
              onAction: async (): Promise<void> => {
                const font = suggestions.pageFonts
                  .flat()
                  .find((item) => item.id === selectionFailureFontId);
                if (font) await selectFont(font);
              },
            },
          ]}
        />
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
