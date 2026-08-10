declare module 'opentype.js' {
  export type PathCommand =
    | { type: 'M' | 'L'; x: number; y: number }
    | { type: 'Q'; x: number; y: number; x1: number; y1: number }
    | { type: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
    | { type: 'Z' };
  export type Path = { commands: PathCommand[] };
  export type Glyph = {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  };
  export type Font = {
    charToGlyphIndex(character: string): number;
    charToGlyph(character: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
    unitsPerEm: number;
  };
  export function parse(buffer: ArrayBuffer): Font;
}
