import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { KeychainParams } from '@/domain/keychain/model/types';

import {
  FONT_CATALOG,
  type FontCategory,
  type FontDefinition,
} from '@/domain/keychain/fonts/catalog';

import type { FontTarget } from '../model/font-browser';

import {
  compatibleSuggestionFont,
  fontCarouselPages,
  fontCardVariant,
  fallbackSuggestionBatch,
  fallbackSuggestionFonts,
  normalizedFontName,
  pageForFont,
  paginateSuggestionBatches,
  paginateSuggestions,
  suggestionFonts,
} from '../model/font-suggestions';

export type FontSuggestionOptions = {
  googleFonts: FontDefinition[];
  googleAvailable?: boolean;
  localFonts?: FontDefinition[];
  loadGoogleFonts: () => Promise<FontDefinition[] | undefined>;
};
type PagePosition = { selectedId: string | undefined; index: number };
type RequestState = { signature: string; status: 'idle' | 'loading'; token: number };
const EMPTY_FONTS: FontDefinition[] = [];
const BUNDLED_NAMES = new Set(FONT_CATALOG.map((font) => normalizedFontName(font.name)));

const unseenFonts = (
  catalog: FontDefinition[],
  batches: FontDefinition[][],
  params: KeychainParams,
  target: FontTarget,
  favorites: FontCategory[],
): FontDefinition[] => {
  const seen = new Set([
    ...BUNDLED_NAMES,
    ...batches.flat().map((font) => normalizedFontName(font.name)),
  ]);

  return catalog
    .filter((font) => {
      const name = normalizedFontName(font.name);
      if (seen.has(name) || !compatibleSuggestionFont(font, params, target)) return false;
      seen.add(name);
      return true;
    })
    .sort(
      (a, b) => Number(favorites.includes(b.category)) - Number(favorites.includes(a.category)),
    );
};

export const useFontSuggestions = (
  params: KeychainParams,
  target: FontTarget,
  favorites: FontCategory[],
  options?: FontSuggestionOptions,
) => {
  const googleFonts = options?.googleFonts ?? EMPTY_FONTS;
  const localFonts = options?.localFonts ?? EMPTY_FONTS;
  const [positions, setPositions] = useState<Partial<Record<FontTarget, PagePosition>>>({});
  const [batches, setBatches] = useState<FontDefinition[][]>([]);
  const [loadedCatalog, setLoadedCatalog] = useState<FontDefinition[]>();
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  );
  const [providerFailed, setProviderFailed] = useState(false);
  const [request, setRequest] = useState<RequestState>({ signature: '', status: 'idle', token: 0 });
  const [revealBatch, setRevealBatch] = useState<{
    revision: number;
    signature: string;
    fontIds: string[];
    firstPage: number;
    firstDot: number;
  }>();
  const revealRevision = useRef(0);
  const loadingSignatureRef = useRef<string | undefined>(undefined);
  const googleCatalogRequestRef = useRef<Promise<FontDefinition[] | undefined> | undefined>(
    undefined,
  );
  const requestTokenRef = useRef(0);
  const activeRequestRef = useRef<{ signature: string; token: number } | undefined>(undefined);
  const mounted = useRef(false);
  const selectedId = target === 'secondary' ? params.subtitleFontId : params.fontId;
  const signature = JSON.stringify([
    target,
    params.templateId,
    target === 'secondary' ? params.subtitle : params.text,
    favorites,
  ]);

  useEffect(() => {
    if (revealBatch && revealBatch.signature !== signature) {
      // A target/text/category change must not replay an older discovery animation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealBatch(undefined);
    }
  }, [revealBatch, signature]);
  const selectedFont = useMemo(
    () => [...FONT_CATALOG, ...googleFonts, ...localFonts].find((font) => font.id === selectedId),
    [googleFonts, localFonts, selectedId],
  );
  const initialPages = useMemo(
    () => paginateSuggestions(suggestionFonts(params, target, favorites)),
    [params, target, favorites],
  );
  const initialNames = useMemo(
    () =>
      new Set(
        initialPages.flat().flatMap((id) => {
          const font = FONT_CATALOG.find((item) => item.id === id);

          return font ? [normalizedFontName(font.name)] : [];
        }),
      ),
    [initialPages],
  );
  // Keep the current font visible even when it is outside the starting categories.
  const sessionBatches = useMemo(
    () =>
      selectedFont &&
      !initialNames.has(normalizedFontName(selectedFont.name)) &&
      !batches
        .flat()
        .some(
          (font) =>
            normalizedFontName(font.name) === normalizedFontName(selectedFont.name) &&
            compatibleSuggestionFont(font, params, target),
        )
        ? [...batches, [selectedFont]]
        : batches,
    [batches, selectedFont, initialNames, params, target],
  );

  useEffect(() => {
    if (sessionBatches !== batches) {
      // Remember an explicitly selected font without changing its position on later selections.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBatches(sessionBatches);
    }
  }, [batches, sessionBatches]);
  const visibleBatches = useMemo(() => {
    const seen = new Set(initialNames);

    return sessionBatches.map((batch) =>
      batch.filter((font) => {
        if (
          seen.has(normalizedFontName(font.name)) ||
          !compatibleSuggestionFont(font, params, target)
        )
          return false;
        seen.add(normalizedFontName(font.name));
        return true;
      }),
    );
  }, [initialNames, sessionBatches, params, target]);
  const externalPages = useMemo(() => paginateSuggestionBatches(visibleBatches), [visibleBatches]);
  const catalog = loadedCatalog ?? googleFonts;
  const catalogKnown = loadedCatalog !== undefined || googleFonts.length > 0;
  const fontById = useMemo(
    () =>
      new Map(
        [...FONT_CATALOG, ...sessionBatches.flat(), ...catalog, ...localFonts].map((font) => [
          font.id,
          fontCardVariant(font, selectedFont, params, target),
        ]),
      ),
    [sessionBatches, catalog, localFonts, selectedFont, params, target],
  );
  const sourcePageIds = useMemo(
    () => [...initialPages, ...externalPages],
    [initialPages, externalPages],
  );
  const pageFonts = useMemo(
    () =>
      sourcePageIds.map((ids) =>
        ids.flatMap((id) => {
          const font = fontById.get(id);

          return font ? [font] : [];
        }),
      ),
    [sourcePageIds, fontById],
  );
  const pageIds = useMemo(
    () => pageFonts.map((fonts) => fonts.map((font) => font.id)),
    [pageFonts],
  );
  const supported = !(target === 'primary' && params.templateId === 'articulated-name');
  const remaining = unseenFonts(catalog, sessionBatches, params, target, favorites);
  const shown = useMemo(() => pageFonts.flat(), [pageFonts]);
  const offlinePool = useMemo(() => [...FONT_CATALOG, ...localFonts], [localFonts]);
  const fallbackRemaining = fallbackSuggestionFonts(offlinePool, shown, params, target);
  const googleAvailable =
    supported &&
    online &&
    !providerFailed &&
    options?.googleAvailable !== false &&
    Boolean(options?.loadGoogleFonts);
  const activeRequest = request.signature === signature ? request : undefined;
  const isLoading = activeRequest?.status === 'loading';
  const canLoadMore =
    fallbackRemaining.length > 0 || (googleAvailable && (!catalogKnown || remaining.length > 0));
  const exhausted = !canLoadMore;
  const carouselPages = useMemo(
    () => fontCarouselPages(pageFonts, canLoadMore || isLoading),
    [pageFonts, canLoadMore, isLoading],
  );
  const totalPages = carouselPages.length;
  const saved = positions[target];
  const pageIndex = Math.max(
    0,
    Math.min(
      saved?.selectedId === selectedId ? saved.index : pageForFont(pageIds, selectedId),
      Math.max(0, totalPages - 1),
    ),
  );
  const latest = useRef({
    signature,
    sessionBatches,
    fontPageCount: pageFonts.length,
    displayPageCount: totalPages,
    params,
    target,
    favorites,
    selectedId,
    shown,
  });

  useLayoutEffect(() => {
    latest.current = {
      signature,
      sessionBatches,
      fontPageCount: pageFonts.length,
      displayPageCount: totalPages,
      params,
      target,
      favorites,
      selectedId,
      shown,
    };
  }, [
    signature,
    sessionBatches,
    pageFonts.length,
    params,
    target,
    favorites,
    selectedId,
    shown,
    totalPages,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setOnline(navigator.onLine !== false);

    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  useEffect(() => {
    if (options?.googleAvailable && googleFonts.length > 0) {
      // Provider recovery updates availability/catalog without resetting discovered pages.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProviderFailed(false);
    }
  }, [options?.googleAvailable, googleFonts]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const goToPage = (index: number): void => {
    if (index < 0 || index >= totalPages || index === pageIndex) return;
    setPositions((current) => ({ ...current, [target]: { selectedId, index } }));
  };
  const loadMore = async (): Promise<void> => {
    if (loadingSignatureRef.current === signature || !canLoadMore) return;
    const token = ++requestTokenRef.current;

    activeRequestRef.current = { signature, token };
    loadingSignatureRef.current = signature;
    setRequest({ signature, status: 'loading', token });
    try {
      let fonts: FontDefinition[] = [];
      if (googleAvailable && options) {
        try {
          const result = catalogKnown
            ? catalog
            : await (googleCatalogRequestRef.current ??= options.loadGoogleFonts());
          if (!mounted.current) return;
          if (result) {
            fonts = result;
            setLoadedCatalog(result);
          } else setProviderFailed(true);
        } catch {
          if (mounted.current) setProviderFailed(true);
        }
      }
      if (!mounted.current) return;
      const current = latest.current;
      if (current.signature !== signature || activeRequestRef.current?.token !== token) return;
      let next = unseenFonts(
        fonts,
        current.sessionBatches,
        current.params,
        current.target,
        current.favorites,
      ).slice(0, 9);
      if (!next.length)
        next = fallbackSuggestionBatch(offlinePool, current.shown, current.params, current.target);
      if (!next.length) return;
      setRevealBatch({
        revision: ++revealRevision.current,
        signature,
        fontIds: next.map((font) => font.id),
        firstPage: current.fontPageCount,
        firstDot: current.displayPageCount,
      });
      setBatches([...current.sessionBatches, next]);
      setPositions((positions) => ({
        ...positions,
        [target]: { selectedId: current.selectedId, index: current.fontPageCount },
      }));
    } finally {
      if (activeRequestRef.current?.token === token) {
        activeRequestRef.current = undefined;
        loadingSignatureRef.current = undefined;
      }
      if (mounted.current)
        setRequest((current) =>
          current.token === token ? { signature, status: 'idle', token } : current,
        );
    }
  };

  return {
    fonts: pageFonts[pageIndex] ?? [],
    pageFonts,
    carouselPages,
    revealBatch: revealBatch?.signature === signature ? revealBatch : undefined,
    page: totalPages ? pageIndex + 1 : 0,
    pages: totalPages,
    goToPage,
    loadMore,
    isLoading,
    canLoadMore,
    exhausted,
  };
};
