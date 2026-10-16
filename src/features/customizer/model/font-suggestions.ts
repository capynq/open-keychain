import type { KeychainParams } from '@/domain/keychain/model/types';

import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  type FontCategory,
  type FontDefinition,
} from '@/domain/keychain/fonts/catalog';

import type { FontTarget } from './font-browser';

export type FontSuggestionPages = string[][];
export const DEFAULT_SIMPLE_FONT_CATEGORIES: readonly FontCategory[] = [
  'Calligraphic',
  'Handwritten',
  'Rounded',
];

export const normalizedFontName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

export const compatibleSuggestionFont = (
  font: FontDefinition,
  params: KeychainParams,
  target: FontTarget,
): boolean => {
  const text = target === 'secondary' ? params.subtitle : params.text;
  return target === 'primary' && params.templateId === 'articulated-name'
    ? fontSupportsArticulatedName(font, text)
    : fontSupportsText(font, text);
};

export const suggestionFonts = (
  params: KeychainParams,
  target: FontTarget,
  favorites: FontCategory[],
): FontDefinition[] => {
  const categories = favorites.length ? favorites : DEFAULT_SIMPLE_FONT_CATEGORIES;
  return FONT_CATALOG.filter(
    (font) => categories.includes(font.category) && compatibleSuggestionFont(font, params, target),
  ).sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
};

/** Paginate each batch independently so newly discovered fonts never fill an older page. */
export const paginateSuggestionBatches = (
  batches: readonly (readonly FontDefinition[])[],
  pageSize = 3,
): FontSuggestionPages => batches.flatMap((batch) => paginateSuggestions(batch, pageSize));

/** Build fixed pages while preferring different categories within each page. */
export const paginateSuggestions = (
  fonts: readonly FontDefinition[],
  pageSize = 3,
): FontSuggestionPages => {
  const remaining = [...fonts];
  const ordered: FontDefinition[] = [];

  while (remaining.length) {
    const categories = new Set<string>();
    const page: FontDefinition[] = [];
    for (const font of remaining) {
      if (page.length === pageSize) break;
      if (!categories.has(font.category)) {
        page.push(font);
        categories.add(font.category);
      }
    }
    for (const font of remaining) {
      if (page.length === pageSize) break;
      if (!page.includes(font)) page.push(font);
    }
    for (const font of page) {
      const index = remaining.indexOf(font);
      if (index >= 0) remaining.splice(index, 1);
      ordered.push(font);
    }
  }

  const pages: string[][] = [];
  for (let index = 0; index < ordered.length; index += pageSize) {
    pages.push(ordered.slice(index, index + pageSize).map((font) => font.id));
  }
  return pages;
};

export const pageForFont = (pages: FontSuggestionPages, selectedId: string | undefined): number => {
  if (!selectedId) return 0;
  const page = pages.findIndex((ids) => ids.includes(selectedId));
  return page >= 0 ? page : 0;
};

export type FontCarouselPage = { fonts: FontDefinition[]; discovery: boolean };

/** Put the discovery action in the final free slot without moving existing font cards. */
export const fontCarouselPages = (
  pages: FontDefinition[][],
  showDiscovery = true,
): FontCarouselPage[] => {
  const result = pages.map((fonts) => ({ fonts, discovery: false }));
  if (!showDiscovery) return result;
  const last = result.at(-1);
  if (last && last.fonts.length < 3) last.discovery = true;
  else result.push({ fonts: [], discovery: true });
  return result;
};

/** Local fallback candidates are compatible, unselected, and absent from the shown families. */
export const fallbackSuggestionFonts = (
  fonts: FontDefinition[],
  shown: FontDefinition[],
  params: KeychainParams,
  target: FontTarget,
): FontDefinition[] => {
  const seen = new Set(shown.map((font) => normalizedFontName(font.name)));
  const selected = new Set([params.fontId, params.subtitleFontId]);
  return fonts.filter((font) => {
    const name = normalizedFontName(font.name);
    if (selected.has(font.id) || seen.has(name) || !compatibleSuggestionFont(font, params, target))
      return false;
    if (font.source === 'google' || (font.source === 'local' && !font.data)) return false;
    seen.add(name);
    return true;
  });
};

/** Randomness is used only on activation; category variety keeps each batch useful. */
export const fallbackSuggestionBatch = (
  fonts: FontDefinition[],
  shown: FontDefinition[],
  params: KeychainParams,
  target: FontTarget,
  count = 9,
  random = Math.random,
): FontDefinition[] => {
  const candidates = fallbackSuggestionFonts(fonts, shown, params, target);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  const selectedCategories = new Set(
    fonts
      .filter((font) => font.id === params.fontId || font.id === params.subtitleFontId)
      .map((font) => font.category),
  );
  candidates.sort(
    (a, b) =>
      Number(selectedCategories.has(a.category)) - Number(selectedCategories.has(b.category)),
  );
  const varied = paginateSuggestions(candidates).flat();
  const byId = new Map(candidates.map((font) => [font.id, font]));
  return varied.slice(0, count).flatMap((id) => {
    const font = byId.get(id);
    return font ? [font] : [];
  });
};

/** Keep the selected provider variant in the existing family card's position. */
export const fontCardVariant = (
  font: FontDefinition,
  selected: FontDefinition | undefined,
  params: KeychainParams,
  target: FontTarget,
): FontDefinition =>
  selected &&
  normalizedFontName(font.name) === normalizedFontName(selected.name) &&
  compatibleSuggestionFont(selected, params, target)
    ? selected
    : font;
