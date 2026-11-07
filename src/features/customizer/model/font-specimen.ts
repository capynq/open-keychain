import type { FontDefinition } from '@/domain/keychain/fonts/catalog';
import type { FontSpecimenScript } from '@/domain/keychain/fonts/font-specimen-text';

import { FONT_SPECIMENS } from '@/domain/keychain/fonts/font-specimens';

/** Bundled fonts ship pre-drawn specimens; other fonts render text once their face loads. */
export const hasFontSpecimen = (fontId: string, script: FontSpecimenScript): boolean =>
  Boolean(FONT_SPECIMENS[fontId]?.[script]);

/** Cyrillic specimens only where the font has Cyrillic and the text being styled uses it. */
export const fontSpecimenScript = (font: FontDefinition, text: string): FontSpecimenScript =>
  font.scripts.includes('cyrillic') && /[Ѐ-ӿ]/u.test(text) ? 'cyrillic' : 'latin';

const warmedFontFiles = new Set<string>();

/**
 * Specimens no longer load the font file, so warm the HTTP cache on hover or focus: the geometry
 * worker then reads the selected bundled font from cache instead of starting the download on
 * click. Low priority keeps it behind anything the page is waiting on.
 */
export const warmBundledFontFile = (font: FontDefinition): void => {
  if (font.source !== 'bundled' || warmedFontFiles.has(font.file)) return;
  warmedFontFiles.add(font.file);
  void fetch(font.file, { priority: 'low' } as RequestInit).catch(() => {
    warmedFontFiles.delete(font.file);
  });
};
