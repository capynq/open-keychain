import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as opentype from 'opentype.js';
import * as prettier from 'prettier';

/**
 * Generate the outline sprite behind the font choice specimens.
 *
 * The Simple font picker and the Quick setup font step show each bundled font as a two-letter
 * specimen. Rendering those as text made the page download every font file in the carousel
 * (about 2.7 MB over the wire for the default suggestions) just to draw "Aa". The outlines are
 * drawn once here with the same per-glyph path the geometry builder uses, at the catalog weight
 * (variable fonts are instanced through their `wght` axis), and shipped as one small SVG sprite.
 */
import { FONT_CATALOG, type FontDefinition } from '../../src/domain/keychain/fonts/catalog';
import { FONT_SPECIMEN_TEXT } from '../../src/domain/keychain/fonts/font-specimen-text';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FONTS_DIRECTORY = path.join(ROOT, 'public/fonts');
const OUTPUT = path.join(ROOT, 'src/domain/keychain/fonts/font-specimens.ts');
const SPRITE_PREFIX = 'specimens-';
/** Every font is normalized to this many units per em so metadata is comparable. */
const EM = 1000;

type Script = keyof typeof FONT_SPECIMEN_TEXT;
/** The parts of opentype.js's font API the shared typings leave out. */
type SpecimenFont = opentype.Font & {
  ascender: number;
  descender: number;
  tables: { fvar?: unknown; os2?: unknown };
  /** Maps text to glyphs after the substitutions opentype.js supports; throws on others. */
  stringToGlyphs(text: string): opentype.Glyph[];
  /** Instances a glyph at the given axis coordinates (variable fonts). */
  variation: {
    getTransform(glyph: opentype.Glyph, coordinates: Record<string, number>): opentype.Glyph;
  };
};
type SpecimenRecord = { id: string; advance: number };
type FontRecord = {
  fontId: string;
  ascent: number;
  descent: number;
  specimens: Partial<Record<Script, SpecimenRecord>>;
};

const loadFont = async (definition: FontDefinition): Promise<SpecimenFont> => {
  const bytes = await readFile(path.join(ROOT, 'public', definition.file));
  /* Node loads the CommonJS build, which exposes the API on `default`, as in keychain-builder.ts. */
  const module = opentype as unknown as {
    parse?: typeof opentype.parse;
    default?: { parse: typeof opentype.parse };
  };
  const parse = module.parse ?? module.default?.parse;
  if (!parse) throw new Error('OpenType parser is unavailable.');
  return parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ) as SpecimenFont;
};

/** The vertical metrics a browser lays the line box out with (typo metrics when the font asks). */
const verticalMetrics = (font: SpecimenFont): { ascent: number; descent: number } => {
  const os2 = font.tables.os2 as
    { fsSelection: number; sTypoAscender: number; sTypoDescender: number } | undefined;
  const useTypoMetrics = os2 && (os2.fsSelection & (1 << 7)) !== 0;
  const scale = EM / font.unitsPerEm;
  const ascent = useTypoMetrics ? os2.sTypoAscender : font.ascender;
  const descent = useTypoMetrics ? -os2.sTypoDescender : -font.descender;
  return { ascent: Math.round(ascent * scale), descent: Math.round(descent * scale) };
};

/** Integer coordinates, then relative commands, so the shipped paths stay small and exact. */
const svgPath = (commands: opentype.PathCommand[]): string => {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const parts: string[] = [];
  const relative = (values: number[]) => {
    const out: number[] = [];
    for (let index = 0; index < values.length; index += 2) {
      out.push(Math.round(values[index]) - x, Math.round(values[index + 1]) - y);
    }
    return out
      .map((value, index) => (index === 0 || value < 0 ? String(value) : ` ${value}`))
      .join('');
  };
  for (const command of commands) {
    if (command.type === 'Z') {
      parts.push('z');
      x = startX;
      y = startY;
      continue;
    }
    const values =
      command.type === 'C'
        ? [command.x1, command.y1, command.x2, command.y2, command.x, command.y]
        : command.type === 'Q'
          ? [command.x1, command.y1, command.x, command.y]
          : [command.x, command.y];
    const segment = relative(values);
    /* Zero-length line segments (common between contours) draw nothing. */
    if (command.type !== 'L' || segment !== '0 0')
      parts.push(`${command.type.toLowerCase()}${segment}`);
    x = Math.round(command.x);
    y = Math.round(command.y);
    if (command.type === 'M') {
      startX = x;
      startY = y;
    }
  }
  return parts.join('');
};

/**
 * Substitutions a browser applies to the same text, such as Lobster's connected final "a".
 * opentype.js cannot run some contextual lookups (Nunito's, for one); those fonts fall back to
 * one glyph per character, which is what they render for these two letters anyway.
 */
const shape = (font: SpecimenFont, text: string): opentype.Glyph[] => {
  try {
    return font.stringToGlyphs(text);
  } catch {
    return [...text].map((character) => font.charToGlyph(character));
  }
};

/** Glyph layout with pair kerning, as in `src/domain/keychain/text/outline.ts`. */
const renderSpecimen = (font: SpecimenFont, text: string, weight: number, shaped = true) => {
  const variation = font.tables.fvar ? { wght: weight } : undefined;
  const scale = EM / font.unitsPerEm;
  const commands: opentype.PathCommand[] = [];
  let cursor = 0;
  let previous: opentype.Glyph | undefined;
  for (const character of text)
    if (font.charToGlyphIndex(character) === 0) throw new Error(`Missing glyph "${character}"`);
  const glyphs = shaped ? shape(font, text) : [...text].map((c) => font.charToGlyph(c));
  for (const glyph of glyphs) {
    if (previous) cursor += font.getKerningValue(previous, glyph) * scale;
    const varied = variation ? font.variation.getTransform(glyph, variation) : glyph;
    commands.push(...glyph.getPath(cursor, 0, EM, variation ? { variation } : {}, font).commands);
    cursor += (varied.advanceWidth ?? glyph.advanceWidth ?? 0) * scale;
    previous = glyph;
  }
  return { d: svgPath(commands), advance: Math.round(cursor) };
};

const records: FontRecord[] = [];
const symbols = new Map<string, string>();
for (const definition of FONT_CATALOG.filter((font) => font.source === 'bundled')) {
  const font = await loadFont(definition);
  const record: FontRecord = { fontId: definition.id, ...verticalMetrics(font), specimens: {} };
  for (const script of Object.keys(FONT_SPECIMEN_TEXT) as Script[]) {
    if (!definition.scripts.includes(script)) continue;
    const text = FONT_SPECIMEN_TEXT[script];
    const latin = record.specimens.latin;
    const unshaped = (value: string) => renderSpecimen(font, value, definition.weight, false).d;
    /*
     * opentype.js cannot run some fonts' Cyrillic substitutions (Lobster's final "а"). Where
     * shaping changed the Latin letters and the Cyrillic ones share their outlines, a browser
     * shapes both alike, so the Cyrillic choice reuses the shaped Latin specimen.
     */
    if (
      script !== 'latin' &&
      latin &&
      symbols.get(latin.id) !== unshaped(FONT_SPECIMEN_TEXT.latin) &&
      unshaped(text) === unshaped(FONT_SPECIMEN_TEXT.latin)
    ) {
      record.specimens[script] = latin;
      continue;
    }
    const { d, advance } = renderSpecimen(font, text, definition.weight);
    /* Identical outlines (Cyrillic А/а drawn like Latin A/a) share one symbol. */
    const shared = latin && symbols.get(latin.id) === d ? latin.id : undefined;
    const id = shared ?? `${definition.id}-${script}`;
    symbols.set(id, d);
    record.specimens[script] = { id, advance };
  }
  records.push(record);
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${[...symbols]
  .map(([id, d]) => `<symbol id="${id}" overflow="visible"><path d="${d}"/></symbol>`)
  .join('')}</svg>\n`;
const spriteName = `${SPRITE_PREFIX}${createHash('sha256').update(sprite).digest('hex').slice(0, 10)}.svg`;
const spritePath = path.join(FONTS_DIRECTORY, spriteName);

const draft = `/* Generated by scripts/generators/generate-font-specimens.ts (pnpm assets:font-specimens). */

/** Outline sprite for bundled font specimens; versioned by content, so it is cached immutably. */
export const FONT_SPECIMEN_SPRITE = '/fonts/${spriteName}';

/** Units per em for every value below. */
export const FONT_SPECIMEN_EM = ${EM};

export type FontSpecimenGlyphs = { id: string; advance: number };
export type FontSpecimenMetrics = {
  ascent: number;
  descent: number;
  latin?: FontSpecimenGlyphs;
  cyrillic?: FontSpecimenGlyphs;
};

export const FONT_SPECIMENS: Readonly<Record<string, FontSpecimenMetrics>> = {
${records
  .map(
    (record) =>
      `  ${JSON.stringify(record.fontId)}: { ascent: ${record.ascent}, descent: ${record.descent}, ${Object.entries(
        record.specimens,
      )
        .map(([script, specimen]) => `${script}: ${JSON.stringify(specimen)}`)
        .join(', ')} },`,
  )
  .join('\n')}
};
`;

const source = await prettier.format(draft, {
  ...(await prettier.resolveConfig(OUTPUT)),
  filepath: OUTPUT,
});
const staleSprites = (await readdir(FONTS_DIRECTORY)).filter(
  (file) => file.startsWith(SPRITE_PREFIX) && file.endsWith('.svg') && file !== spriteName,
);

if (process.argv.includes('--check')) {
  const current = await readFile(OUTPUT, 'utf8').catch(() => '');
  const currentSprite = await readFile(spritePath, 'utf8').catch(() => '');
  if (current !== source || currentSprite !== sprite || staleSprites.length) {
    console.error(
      'Font specimens are out of date. Run `pnpm assets:font-specimens` to regenerate them.',
    );
    process.exitCode = 1;
  }
} else {
  await Promise.all(staleSprites.map((file) => rm(path.join(FONTS_DIRECTORY, file))));
  await writeFile(spritePath, sprite, 'utf8');
  await writeFile(OUTPUT, source, 'utf8');
  console.log(
    `wrote public/fonts/${spriteName} (${(sprite.length / 1024).toFixed(1)} KB, ${symbols.size} symbols) and ${path.relative(ROOT, OUTPUT)}`,
  );
}
