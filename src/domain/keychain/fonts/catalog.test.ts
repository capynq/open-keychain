import { describe, expect, it } from 'vitest';
import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
} from './catalog';
describe('font script coverage metadata', () => {
  it('recognizes Cyrillic text and disables Latin-only families', () => {
    expect(textUsesCyrillic('Привет')).toBe(true);
    expect(textUsesCyrillic('ALEX')).toBe(false);
    const latinOnly = FONT_CATALOG.filter((font) => !font.scripts.includes('cyrillic'));
    expect(latinOnly.map((font) => font.id)).toEqual([
      'quicksand',
      'fredoka',
      'bree-serif',
      'baloo2',
      'kalam',
      'bungee',
    ]);
    expect(latinOnly.every((font) => !fontSupportsText(font, 'НИКИТА'))).toBe(true);
  });
  it('limits articulated names to the bundled heavy families', () => {
    const articulated = FONT_CATALOG.filter((font) => font.supportsArticulated);
    expect(articulated.map((font) => font.id)).toEqual(['bungee', 'rubik', 'montserrat']);
    expect(articulated.every((font) => (font.articulatedDilationMm ?? 0) > 0)).toBe(true);
    expect(articulated.every((font) => fontSupportsArticulatedName(font, 'ALEX'))).toBe(true);
    expect(
      fontSupportsArticulatedName(
        FONT_CATALOG.find((font) => font.id === 'rubik')!,
        'НІКІТА',
      ),
    ).toBe(true);
    expect(
      fontSupportsArticulatedName(
        FONT_CATALOG.find((font) => font.id === 'montserrat')!,
        'НІКІТА',
      ),
    ).toBe(true);
    expect(
      fontSupportsArticulatedName(
        FONT_CATALOG.find((font) => font.id === 'nunito')!,
        'ALEX',
      ),
    ).toBe(false);
    expect(
      fontSupportsArticulatedName(
        FONT_CATALOG.find((font) => font.id === 'fredoka')!,
        'ALEX',
      ),
    ).toBe(false);
    expect(
      fontSupportsArticulatedName(
        FONT_CATALOG.find((font) => font.id === 'caveat')!,
        'ALEX',
      ),
    ).toBe(false);
  });
  it('includes the bilingual calligraphic families', () => {
    const calligraphic = FONT_CATALOG.filter((font) => font.category === 'Calligraphic');
    expect(calligraphic.map((font) => font.id)).toEqual([
      'caveat',
      'marck-script',
      'bad-script',
      'lobster',
      'comforter',
      'comforter-brush',
    ]);
    expect(
      calligraphic.every(
        (font) => font.scripts.includes('latin') && font.scripts.includes('cyrillic'),
      ),
    ).toBe(true);
    expect(calligraphic.every((font) => font.sampleLatin && font.sampleCyrillic)).toBe(true);
  });
  it('groups casual and marker-style Cyrillic handwriting families', () => {
    expect(
      FONT_CATALOG.filter((font) => font.category === 'Handwritten').map((font) => font.id),
    ).toEqual(['kalam', 'neucha', 'pangolin', 'playpen-sans', 'shantell-sans', 'balsamiq-sans']);
    expect(
      FONT_CATALOG.filter((font) => font.category === 'Marker').map((font) => font.id),
    ).toEqual(['amatic-sc', 'underdog']);
  });
  it('keeps font preview family and weight metadata centralized', () => {
    expect(FONT_CATALOG.every((font) => font.previewFamily && font.weight > 0)).toBe(true);
    expect(FONT_CATALOG.find((font) => font.id === 'montserrat')).toMatchObject({
      previewFamily: 'OpenMontserrat',
      weight: 900,
    });
  });
});
