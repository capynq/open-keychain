import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import {
  FONT_CATEGORY_ORDER,
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  type FontCategory,
  type FontDefinition,
} from '@/domain/keychain/fonts/catalog';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { useCustomizerParams } from './useCustomizerParams';

import {
  INITIAL_FONT_BROWSER_STATE,
  type FontBrowserState,
  type FontSourceTab,
  type FontTarget,
} from '../model/font-browser';
import { useFontPreviewLoader } from './useFontPreviewLoader';

export const useFontBrowser = ({
  customizer,
  target,
  favoriteFontCategories,
  onFontProposed,
}: {
  customizer: ReturnType<typeof useCustomizerParams>;
  target: FontTarget;
  favoriteFontCategories: FontCategory[];
  onFontProposed?: (fontId: string, target: FontTarget) => void;
}) => {
  const { track } = useAnalytics();
  const { params } = customizer;
  const [fontSource, setFontSource] = useState<FontSourceTab>('bundled');
  const [fontBrowserState, setFontBrowserState] = useState(INITIAL_FONT_BROWSER_STATE);
  const contextKey = JSON.stringify([
    target,
    params.templateId,
    target === 'secondary' ? params.subtitle : params.text,
  ]);
  const [loadError, setLoadError] = useState<{
    context: string;
    fontId: string;
    failure: RecoveryFailure;
  }>();
  const [loadingSelection, setLoadingSelection] = useState<{
    id: string;
    context: string;
    version: number;
  }>();
  const fontLoadError = loadError?.context === contextKey ? loadError.failure : undefined;
  const fontLoadErrorFontId = loadError?.context === contextKey ? loadError.fontId : undefined;
  const loadingFontId = loadingSelection?.context === contextKey ? loadingSelection.id : undefined;
  const { loadFont, loadFontWithFailure } = useFontPreviewLoader();
  const [previewFontId, setPreviewFontId] = useState<string>();
  const [showAllFontCategories, setShowAllFontCategories] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<FontCategory>>(
    () => new Set(FONT_CATEGORY_ORDER),
  );
  const selectionVersion = useRef(0);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    selectionVersion.current += 1;
    return () => {
      mounted.current = false;
      selectionVersion.current += 1;
    };
  }, [contextKey]);
  const activeTargetText = target === 'secondary' ? params.subtitle : params.text;
  const activeTargetFontId = target === 'secondary' ? params.subtitleFontId : params.fontId;
  const activeBrowserState = fontBrowserState[fontSource];
  const fileSystemPickerAvailable =
    typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
  const sourceFonts =
    fontSource === 'google'
      ? customizer.googleFonts
      : fontSource === 'local'
        ? customizer.localFonts.flatMap((record) => (record.font ? [record.font] : []))
        : FONT_CATALOG;
  const restrictToFavorites =
    favoriteFontCategories.length > 0 &&
    !showAllFontCategories &&
    activeBrowserState.category === 'all' &&
    !activeBrowserState.search.trim();
  const filteredFonts = useMemo(() => {
    const query = activeBrowserState.search.trim().toLocaleLowerCase();

    return sourceFonts.filter(
      (font) =>
        (target === 'primary' && params.templateId === 'articulated-name'
          ? fontSupportsArticulatedName(font, activeTargetText)
          : !activeBrowserState.supportsTextOnly || fontSupportsText(font, activeTargetText)) &&
        (!restrictToFavorites || favoriteFontCategories.includes(font.category)) &&
        (activeBrowserState.category === 'all' || font.category === activeBrowserState.category) &&
        (!query ||
          font.name.toLocaleLowerCase().includes(query) ||
          font.category.toLocaleLowerCase().includes(query)),
    );
  }, [
    activeBrowserState,
    sourceFonts,
    target,
    params.templateId,
    activeTargetText,
    restrictToFavorites,
    favoriteFontCategories,
  ]);
  const shouldPaginate = fontSource === 'google';
  const pageCount = shouldPaginate ? Math.max(1, Math.ceil(filteredFonts.length / 12)) : 1;
  const currentPage = Math.min(activeBrowserState.page, pageCount);
  const visibleFonts = shouldPaginate
    ? filteredFonts.slice((currentPage - 1) * 12, currentPage * 12)
    : filteredFonts;
  const bootVisibleFonts = FONT_CATEGORY_ORDER.flatMap((category) =>
    visibleFonts.filter((font) => font.category === category),
  ).slice(0, 6);
  const orderedFontCategories = [
    ...favoriteFontCategories,
    ...FONT_CATEGORY_ORDER.filter((category) => !favoriteFontCategories.includes(category)),
  ];
  const updateFontBrowserState = (changes: Partial<FontBrowserState>): void => {
    setFontBrowserState((current) => ({
      ...current,
      [fontSource]: { ...current[fontSource], ...changes },
    }));
  };
  const activateFontSource = (source: FontSourceTab): void => {
    setFontSource(source);
    if (source === 'google' && !customizer.googleFonts.length && !customizer.googleError)
      void customizer.loadGoogleFonts();
  };
  const loadGoogleFont = loadFont;
  const selectFont = async (font: FontDefinition): Promise<void> => {
    const version = ++selectionVersion.current;

    setLoadError(undefined);
    setLoadingSelection({ id: font.id, context: contextKey, version });
    const selectionTarget = target;
    const loaded = await loadFontWithFailure(font);
    if (version !== selectionVersion.current) {
      if (mounted.current)
        setLoadingSelection((current) => (current?.version === version ? undefined : current));
      return;
    }
    if (!loaded.ok) {
      setLoadError({ context: contextKey, fontId: font.id, failure: loaded.failure });
      setLoadingSelection(undefined);
      return;
    }
    if (selectionTarget === 'secondary') customizer.updateSubtitleFont(font.id);
    else customizer.update('fontId', font.id);
    onFontProposed?.(font.id, selectionTarget);
    if (font.source === 'bundled')
      track('customizer_option_changed', { family: 'font', option_id: font.id });
    setLoadingSelection(undefined);
  };

  return {
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
    fontLoadErrorFontId,
    activeTargetText,
    activeTargetFontId,
  };
};
