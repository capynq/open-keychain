import { describe, expect, it } from 'vitest';
import { flattenText, layoutText } from './outline';
describe('font coordinate normalization', () => {
  it('maps OpenType Y-down outlines into world-space Y-up', () => {
    const glyph = {
      advanceWidth: 100,
      getPath: () => ({
        commands: [
          { type: 'M' as const, x: 0, y: 0 },
          { type: 'L' as const, x: 0, y: -100 },
          { type: 'L' as const, x: 80, y: -100 },
          { type: 'L' as const, x: 80, y: 0 },
          { type: 'Z' as const },
        ],
      }),
    };
    const font = {
      charToGlyph: () => glyph,
      charToGlyphIndex: () => 1,
      getKerningValue: () => 0,
      unitsPerEm: 100,
    };
    const outline = flattenText(font, 'A', 20);
    expect(outline.polygons[0][0][1]).toBe(-10);
    expect(outline.polygons[0][1][1]).toBe(10);
  });
  it('separates overhanging neighboring glyph contours by the requested spacing', () => {
    const glyph = {
      advanceWidth: 60,
      getPath: (offset: number) => ({
        commands: [
          { type: 'M' as const, x: offset, y: 0 },
          { type: 'L' as const, x: offset, y: -100 },
          { type: 'L' as const, x: offset + 100, y: -100 },
          { type: 'L' as const, x: offset + 100, y: 0 },
          { type: 'Z' as const },
        ],
      }),
    };
    const font = {
      charToGlyph: () => glyph,
      charToGlyphIndex: () => 1,
      getKerningValue: () => 0,
      unitsPerEm: 100,
    };
    const outline = flattenText(font, 'AB', 20, 2);
    const bounds = outline.polygons.map((polygon) => ({
      min: Math.min(...polygon.map(([x]) => x)),
      max: Math.max(...polygon.map(([x]) => x)),
    }));
    bounds.sort((left, right) => left.min - right.min);
    expect(bounds[1].min - bounds[0].max).toBeCloseTo(2, 3);
  });
  it('keeps kerning and glyph metrics in the shared text layout', () => {
    const glyph = {
      advanceWidth: 600,
      getPath: (offset: number) => ({
        commands: [
          { type: 'M' as const, x: offset, y: 0 },
          { type: 'L' as const, x: offset, y: -500 },
          { type: 'L' as const, x: offset + 400, y: -500 },
          { type: 'L' as const, x: offset + 80, y: 0 },
          { type: 'Z' as const },
        ],
      }),
    };
    const font = {
      charToGlyph: () => glyph,
      charToGlyphIndex: () => 1,
      getKerningValue: () => -100,
      unitsPerEm: 1000,
    };
    const layout = layoutText(font, 'AB', 20, 0, true);
    expect(layout.glyphs).toHaveLength(2);
    expect(layout.kerning).toEqual([0, -0.4]);
    expect(layout.advances[0]).toBeCloseTo(2.4, 3);
    expect(layout.advances[1]).toBeCloseTo(2.4, 3);
    expect(layout.bounds).toEqual(layout.outline.bounds);
  });
});
