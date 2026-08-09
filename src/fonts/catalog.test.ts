import { describe, expect, it } from 'vitest';
import { FONT_CATALOG, fontSupportsText, textUsesCyrillic } from './catalog';

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

  it('includes the bilingual calligraphic families', () => {
    const calligraphic = FONT_CATALOG.filter((font) => font.category === 'Calligraphic');
    expect(calligraphic.map((font) => font.id)).toEqual([
      'caveat',
      'marck-script',
      'bad-script',
      'neucha',
      'amatic-sc',
      'lobster',
      'pangolin',
    ]);
    expect(calligraphic.every((font) => font.scripts.includes('latin') && font.scripts.includes('cyrillic'))).toBe(
      true,
    );
    expect(calligraphic.every((font) => font.sampleLatin && font.sampleCyrillic)).toBe(true);
  });
});
