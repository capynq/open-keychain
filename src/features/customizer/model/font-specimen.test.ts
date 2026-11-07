import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import { FONT_SPECIMEN_SPRITE, FONT_SPECIMENS } from '@/domain/keychain/fonts/font-specimens';

import { fontSpecimenScript, hasFontSpecimen } from './font-specimen';

const sprite = readFileSync(
  new URL(`../../../../public${FONT_SPECIMEN_SPRITE}`, import.meta.url),
  'utf8',
);
const symbolIds = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]));

describe('font specimens', () => {
  it('draws every script of every bundled font from a symbol in the sprite', () => {
    for (const font of FONT_CATALOG.filter((entry) => entry.source === 'bundled')) {
      for (const script of font.scripts) {
        expect(hasFontSpecimen(font.id, script), `${font.id} ${script}`).toBe(true);
        const glyphs = FONT_SPECIMENS[font.id][script]!;
        expect(symbolIds.has(glyphs.id), `${glyphs.id} in sprite`).toBe(true);
        expect(glyphs.advance).toBeGreaterThan(500);
      }
    }
  });

  it('has no specimen for fonts loaded at runtime', () => {
    expect(hasFontSpecimen('google-roboto', 'latin')).toBe(false);
  });

  it('uses Cyrillic only for fonts that have it and text that needs it', () => {
    const nunito = FONT_CATALOG.find((font) => font.id === 'nunito')!;
    const quicksand = FONT_CATALOG.find((font) => font.id === 'quicksand')!;
    expect(fontSpecimenScript(nunito, 'Аня')).toBe('cyrillic');
    expect(fontSpecimenScript(nunito, 'Anna')).toBe('latin');
    expect(fontSpecimenScript(quicksand, 'Аня')).toBe('latin');
  });
});
