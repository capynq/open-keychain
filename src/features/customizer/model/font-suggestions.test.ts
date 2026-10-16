import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import { DEFAULT_PARAMS } from '@/domain/keychain/model/types';

import {
  DEFAULT_SIMPLE_FONT_CATEGORIES,
  fallbackSuggestionBatch,
  fallbackSuggestionFonts,
  fontCarouselPages,
  fontCardVariant,
  normalizedFontName,
  pageForFont,
  paginateSuggestionBatches,
  paginateSuggestions,
  suggestionFonts,
} from './font-suggestions';

describe('font carousel pages', () => {
  it('offers each font once across complete three-card pages and the final remainder', () => {
    const pages = paginateSuggestions(FONT_CATALOG);
    const ids = pages.flat();
    expect(ids).toHaveLength(FONT_CATALOG.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(FONT_CATALOG.map((font) => font.id)));
    expect(pages.slice(0, -1).every((page) => page.length === 3)).toBe(true);
    expect(pages.at(-1)?.length).toBeGreaterThan(0);
    expect(pages.at(-1)?.length).toBeLessThanOrEqual(3);
  });

  it('finds the selected font even on a later page and starts safely for an external font', () => {
    const pages = paginateSuggestions(FONT_CATALOG);
    const last = pages.length - 1;
    expect(pageForFont(pages, pages[last][0])).toBe(last);
    expect(pageForFont(pages, 'external-font')).toBe(0);
    expect(pageForFont([], undefined)).toBe(0);
  });

  it('keeps discovered batches separate from an older partial page', () => {
    const first = FONT_CATALOG.slice(0, 4);
    const second = FONT_CATALOG.slice(4, 13);
    const pages = paginateSuggestionBatches([first, second]);
    expect(pages.slice(0, 2).map((page) => page.length)).toEqual([3, 1]);
    expect(pages.slice(2).every((page) => page.length === 3)).toBe(true);
  });

  it('normalizes names for accent and punctuation insensitive deduplication', () => {
    expect(normalizedFontName('  Café Sans  ')).toBe(normalizedFontName('cafe-sans'));
    expect(normalizedFontName('A/B Sans')).toBe(normalizedFontName('a b sans'));
  });
});

describe('font discovery card placement', () => {
  it('uses an empty slot on the final partial page', () => {
    for (const count of [1, 2]) {
      const fonts = FONT_CATALOG.slice(0, count);
      const pages = fontCarouselPages([fonts]);
      expect(pages).toEqual([{ fonts, discovery: true }]);
      expect(pages[0].fonts).toBe(fonts);
    }
  });

  it('adds a page only when the last font page is full', () => {
    const fonts = FONT_CATALOG.slice(0, 3);
    expect(fontCarouselPages([fonts])).toEqual([
      { fonts, discovery: false },
      { fonts: [], discovery: true },
    ]);
    expect(fontCarouselPages([])).toEqual([{ fonts: [], discovery: true }]);
  });

  it('moves the action after appended fonts without repacking an older partial page', () => {
    const initial = [FONT_CATALOG.slice(0, 3), FONT_CATALOG.slice(3, 5)];
    const before = fontCarouselPages(initial);
    const appended = [...initial, FONT_CATALOG.slice(5, 8), FONT_CATALOG.slice(8, 11)];
    const after = fontCarouselPages(appended);
    expect(before[1].discovery).toBe(true);
    expect(after.slice(0, 2).map((page) => page.fonts)).toEqual(initial);
    expect(after[1].fonts).toBe(initial[1]);
    expect(after[1].discovery).toBe(false);
    expect(after.at(-1)).toEqual({ fonts: [], discovery: true });
    expect(initial.map((page) => page.length)).toEqual([3, 2]);
  });
});

describe('starting categories and offline discovery', () => {
  it('starts with setup categories or the three default categories', () => {
    const chosen = suggestionFonts(DEFAULT_PARAMS, 'primary', ['Geometric', 'Serif']);
    expect(chosen.length).toBeGreaterThan(0);
    expect(chosen.every((font) => ['Geometric', 'Serif'].includes(font.category))).toBe(true);
    const defaults = suggestionFonts(DEFAULT_PARAMS, 'primary', []);
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.every((font) => DEFAULT_SIMPLE_FONT_CATEGORIES.includes(font.category))).toBe(
      true,
    );
  });

  it('reveals unseen unselected compatible local fonts without repeats', () => {
    const shown = suggestionFonts(DEFAULT_PARAMS, 'primary', []);
    const next = fallbackSuggestionBatch(
      FONT_CATALOG,
      shown,
      DEFAULT_PARAMS,
      'primary',
      9,
      () => 0.5,
    );
    const shownNames = new Set(shown.map((font) => normalizedFontName(font.name)));
    expect(next.length).toBeGreaterThan(0);
    expect(
      next.every(
        (font) =>
          !shownNames.has(normalizedFontName(font.name)) &&
          font.id !== DEFAULT_PARAMS.fontId &&
          font.id !== DEFAULT_PARAMS.subtitleFontId,
      ),
    ).toBe(true);
    expect(new Set(next.map((font) => normalizedFontName(font.name))).size).toBe(next.length);
    expect(
      fallbackSuggestionFonts(FONT_CATALOG, [...shown, ...next], DEFAULT_PARAMS, 'primary').every(
        (font) => !next.some((item) => item.id === font.id),
      ),
    ).toBe(true);
  });

  it('hides discovery entirely when no source has more fonts', () => {
    const fonts = FONT_CATALOG.slice(0, 3);
    expect(fontCarouselPages([fonts], false)).toEqual([{ fonts, discovery: false }]);
    expect(fontCarouselPages([fonts.slice(0, 2)], false)).toEqual([
      { fonts: fonts.slice(0, 2), discovery: false },
    ]);
    expect(fallbackSuggestionFonts(FONT_CATALOG, FONT_CATALOG, DEFAULT_PARAMS, 'primary')).toEqual(
      [],
    );
  });

  it('keeps offline fallback inside articulated and Cyrillic restrictions', () => {
    const params = { ...DEFAULT_PARAMS, templateId: 'articulated-name' as const, text: 'Анна' };
    const fonts = fallbackSuggestionFonts(FONT_CATALOG, [], params, 'primary');
    expect(
      fonts.every((font) => font.supportsArticulated && font.scripts.includes('cyrillic')),
    ).toBe(true);
  });
});

describe('selected font family variants', () => {
  it('uses a selected Google variant in the existing bundled family card', () => {
    const bundled = FONT_CATALOG[0];
    const selected = {
      ...bundled,
      id: 'google-family-fixture',
      source: 'google' as const,
      provider: 'google-fonts' as const,
    };
    expect(fontCardVariant(bundled, selected, DEFAULT_PARAMS, 'primary')).toBe(selected);
  });

  it('uses a selected local variant in the existing Google family card', () => {
    const google = {
      ...FONT_CATALOG[0],
      id: 'google-variant-fixture',
      source: 'google' as const,
      provider: 'google-fonts' as const,
    };
    const selected = {
      ...google,
      id: 'local-variant-fixture',
      source: 'local' as const,
      provider: 'local-file' as const,
    };
    expect(fontCardVariant(google, selected, DEFAULT_PARAMS, 'primary')).toBe(selected);
    const incompatible = { ...selected, supportsArticulated: false };
    expect(
      fontCardVariant(
        google,
        incompatible,
        { ...DEFAULT_PARAMS, templateId: 'articulated-name' },
        'primary',
      ),
    ).toBe(google);
  });
});
