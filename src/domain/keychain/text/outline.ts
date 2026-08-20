import type * as opentype from 'opentype.js';
export type Point = [number, number];
export type TextOutline = {
  polygons: Point[][];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  width: number;
  height: number;
};
export type GlyphOutline = {
  character: string;
  polygons: Point[][];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  width: number;
  height: number;
  advance: number;
  /** Conversion from the font's 100-unit path space into final millimetres. */
  scale: number;
};
export type TextLayout = {
  outline: TextOutline;
  glyphs: GlyphOutline[];
  advances: number[];
  kerning: number[];
  bounds: TextOutline['bounds'];
};
const MAX_CURVE_DEPTH = 12;
const distanceToLine = (point: Point, start: Point, end: Point): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return (
    Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) /
    Math.hypot(dx, dy)
  );
};
const flattenQuadratic = (
  start: Point,
  control: Point,
  end: Point,
  tolerance: number,
  depth = 0,
): Point[] => {
  if (depth >= MAX_CURVE_DEPTH || distanceToLine(control, start, end) <= tolerance) return [end];
  const a: Point = [(start[0] + control[0]) / 2, (start[1] + control[1]) / 2];
  const b: Point = [(control[0] + end[0]) / 2, (control[1] + end[1]) / 2];
  const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [
    ...flattenQuadratic(start, a, middle, tolerance, depth + 1),
    ...flattenQuadratic(middle, b, end, tolerance, depth + 1),
  ];
};
const flattenCubic = (
  start: Point,
  c1: Point,
  c2: Point,
  end: Point,
  tolerance: number,
  depth = 0,
): Point[] => {
  if (
    depth >= MAX_CURVE_DEPTH ||
    Math.max(distanceToLine(c1, start, end), distanceToLine(c2, start, end)) <= tolerance
  ) {
    return [end];
  }
  const a: Point = [(start[0] + c1[0]) / 2, (start[1] + c1[1]) / 2];
  const b: Point = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
  const c: Point = [(c2[0] + end[0]) / 2, (c2[1] + end[1]) / 2];
  const d: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const e: Point = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const middle: Point = [(d[0] + e[0]) / 2, (d[1] + e[1]) / 2];
  return [
    ...flattenCubic(start, a, d, middle, tolerance, depth + 1),
    ...flattenCubic(middle, e, c, end, tolerance, depth + 1),
  ];
};
const dedupe = (points: Point[]): Point[] => {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.001)
      result.push(point);
  }
  if (
    result.length > 1 &&
    Math.hypot(result[0][0] - result.at(-1)![0], result[0][1] - result.at(-1)![1]) < 0.001
  ) {
    result.pop();
  }
  return result;
};
const flattenPath = (path: opentype.Path, tolerance: number): Point[][] => {
  const polygons: Point[][] = [];
  let current: Point[] = [];
  let currentPoint: Point = [0, 0];
  const finish = () => {
    const polygon = dedupe(current);
    if (polygon.length >= 3) polygons.push(polygon);
    current = [];
  };
  for (const command of path.commands) {
    if (command.type === 'M') {
      if (current.length) finish();
      currentPoint = [command.x, command.y];
      current.push(currentPoint);
    } else if (command.type === 'L') {
      currentPoint = [command.x, command.y];
      current.push(currentPoint);
    } else if (command.type === 'Q') {
      const end: Point = [command.x, command.y];
      current.push(...flattenQuadratic(currentPoint, [command.x1, command.y1], end, tolerance));
      currentPoint = end;
    } else if (command.type === 'C') {
      const end: Point = [command.x, command.y];
      current.push(
        ...flattenCubic(
          currentPoint,
          [command.x1, command.y1],
          [command.x2, command.y2],
          end,
          tolerance,
        ),
      );
      currentPoint = end;
    } else if (command.type === 'Z') finish();
  }
  if (current.length) finish();
  return polygons;
};
const commandPoints = (paths: opentype.Path[]): Point[] => {
  return paths.flatMap((path) =>
    path.commands.flatMap((command) => {
      if (command.type === 'Z') return [];
      if (
        command.type !== 'M' &&
        command.type !== 'L' &&
        command.type !== 'Q' &&
        command.type !== 'C'
      )
        return [];
      const points: Point[] = [[command.x, command.y]];
      if (command.type === 'Q' || command.type === 'C') points.push([command.x1, command.y1]);
      if (command.type === 'C') points.push([command.x2, command.y2]);
      return points;
    }),
  );
};
/** Create independent, locally centered outlines for the articulated mechanical layout. */
export const flattenTextGlyphs = (
  font: opentype.Font,
  text: string,
  targetHeightMm: number,
): GlyphOutline[] => {
  const characters = [...text];
  const glyphs = characters.map((character) => font.charToGlyph(character));
  let advanceCursor = 0;
  const paths = glyphs.map((glyph) => {
    const path = glyph.getPath(advanceCursor, 0, 100);
    advanceCursor += (glyph.advanceWidth / font.unitsPerEm) * 100;
    return path;
  });
  const points = commandPoints(paths);
  if (!points.length) return [];
  const rawMinY = Math.min(...points.map((point) => point[1]));
  const rawMaxY = Math.max(...points.map((point) => point[1]));
  const rawHeight = Math.max(rawMaxY - rawMinY, 1);
  const scale = targetHeightMm / rawHeight;
  const tolerance = Math.max(0.003, 0.035 / scale);
  const centerY = (rawMinY + rawMaxY) / 2;
  return paths.map((path, index) => {
    const rawPolygons = flattenPath(path, tolerance);
    const raw = rawPolygons.flat();
    const firstPoint = commandPoints([paths[index]])[0];
    const rawMinX = raw.length ? Math.min(...raw.map((point) => point[0])) : (firstPoint?.[0] ?? 0);
    const rawMaxX = raw.length ? Math.max(...raw.map((point) => point[0])) : rawMinX;
    const centerX = (rawMinX + rawMaxX) / 2;
    const polygons = rawPolygons.map((polygon) =>
      polygon.map(
        ([x, y]) =>
          [
            Math.round((x - centerX) * scale * 1000) / 1000,
            Math.round(-(y - centerY) * scale * 1000) / 1000,
          ] as Point,
      ),
    );
    const scaled = polygons.flat();
    const minX = scaled.length ? Math.min(...scaled.map((point) => point[0])) : 0;
    const maxX = scaled.length ? Math.max(...scaled.map((point) => point[0])) : 0;
    const minY = scaled.length ? Math.min(...scaled.map((point) => point[1])) : 0;
    const maxY = scaled.length ? Math.max(...scaled.map((point) => point[1])) : 0;
    return {
      character: characters[index],
      polygons,
      bounds: { minX, minY, maxX, maxY },
      width: maxX - minX,
      height: maxY - minY,
      advance: (glyphs[index].advanceWidth / font.unitsPerEm) * 100 * scale,
      scale,
    };
  });
};
/** Flatten font curves with a final-space tolerance and separate glyph groups for collision-safe spacing. */
export const flattenText = (
  font: opentype.Font,
  text: string,
  targetHeightMm: number,
  letterSpacingMm = 0,
): TextOutline => {
  const fontGlyphs = [...text].map((character) => font.charToGlyph(character));
  const paths: opentype.Path[] = [];
  let advanceCursor = 0;
  let previous: opentype.Glyph | undefined;
  for (const glyph of fontGlyphs) {
    paths.push(glyph.getPath(advanceCursor, 0, 100));
    const kerning = previous ? font.getKerningValue(previous, glyph) : 0;
    advanceCursor += ((glyph.advanceWidth + kerning) / font.unitsPerEm) * 100;
    previous = glyph;
  }
  const pathPoints = paths.flatMap((path) =>
    path.commands.flatMap((command) => {
      if (command.type === 'Z') return [];
      if (
        command.type !== 'M' &&
        command.type !== 'L' &&
        command.type !== 'Q' &&
        command.type !== 'C'
      )
        return [];
      const points: Point[] = [[command.x, command.y]];
      if (command.type === 'Q' || command.type === 'C') points.push([command.x1, command.y1]);
      if (command.type === 'C') points.push([command.x2, command.y2]);
      return points;
    }),
  );
  const sourceHeight = pathPoints.length
    ? Math.max(...pathPoints.map((point) => point[1])) -
      Math.min(...pathPoints.map((point) => point[1]))
    : 100;
  const finalScale = targetHeightMm / Math.max(sourceHeight, 1);
  const tolerance = Math.max(0.003, 0.035 / finalScale);
  const glyphPolygons = paths.map((path) => flattenPath(path, tolerance));
  const all = glyphPolygons.flat(2);
  if (!all.length) {
    return {
      polygons: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      width: 0,
      height: 0,
    };
  }
  const rawMinY = Math.min(...all.map((point) => point[1]));
  const rawMaxY = Math.max(...all.map((point) => point[1]));
  const rawHeight = Math.max(rawMaxY - rawMinY, 1);
  const scale = targetHeightMm / rawHeight;
  const scaledGroups = glyphPolygons.map((group) =>
    group.map((polygon) => polygon.map(([x, y]) => [x * scale, y * scale] as Point)),
  );
  let previousMaxX: number | undefined;
  for (const group of scaledGroups) {
    const points = group.flat();
    if (!points.length) continue;
    const minX = Math.min(...points.map((point) => point[0]));
    const maxX = Math.max(...points.map((point) => point[0]));
    const shift =
      previousMaxX === undefined
        ? 0
        : Math.max(0, previousMaxX + Math.max(0, letterSpacingMm) - minX);
    if (shift) for (const polygon of group) for (const point of polygon) point[0] += shift;
    previousMaxX = maxX + shift;
  }
  const spaced = scaledGroups.flat(2);
  const spacedMinX = Math.min(...spaced.map((point) => point[0]));
  const spacedMaxX = Math.max(...spaced.map((point) => point[0]));
  const spacedMinY = Math.min(...spaced.map((point) => point[1]));
  const spacedMaxY = Math.max(...spaced.map((point) => point[1]));
  const centerX = (spacedMinX + spacedMaxX) / 2;
  const centerY = (spacedMinY + spacedMaxY) / 2;
  const polygons = scaledGroups.flatMap((group) =>
    group.map((polygon) =>
      polygon.map(
        ([x, y]) =>
          [
            Math.round((x - centerX) * 1000) / 1000,
            Math.round(-(y - centerY) * 1000) / 1000,
          ] as Point,
      ),
    ),
  );
  const points = polygons.flat();
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxY = Math.max(...points.map((point) => point[1]));
  return {
    polygons,
    bounds: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
};
/** Shared metrics boundary for standard and articulated builders. */
export const layoutText = (
  font: opentype.Font,
  text: string,
  targetHeightMm: number,
  letterSpacingMm = 0,
  includeGlyphs = false,
): TextLayout => {
  const characters = [...text];
  const glyphs = includeGlyphs ? flattenTextGlyphs(font, text, targetHeightMm) : [];
  const outline = flattenText(font, text, targetHeightMm, letterSpacingMm);
  const kerning: number[] = [];
  const advances: number[] = [];
  const metricPaths: opentype.Path[] = [];
  let metricCursor = 0;
  let metricPrevious: opentype.Glyph | undefined;
  for (const character of characters) {
    const glyph = font.charToGlyph(character);
    const metricKerning = metricPrevious ? font.getKerningValue(metricPrevious, glyph) : 0;
    metricPaths.push(glyph.getPath(metricCursor, 0, 100));
    metricCursor += ((glyph.advanceWidth + metricKerning) / font.unitsPerEm) * 100;
    metricPrevious = glyph;
  }
  const metricPoints = commandPoints(metricPaths);
  const metricHeight = metricPoints.length
    ? Math.max(...metricPoints.map((point) => point[1])) -
      Math.min(...metricPoints.map((point) => point[1]))
    : 100;
  const outlineScale = targetHeightMm / Math.max(metricHeight, 1);
  let previous: opentype.Glyph | undefined;
  for (const character of characters) {
    const glyph = font.charToGlyph(character);
    const value = previous
      ? (font.getKerningValue(previous, glyph) / font.unitsPerEm) * 100 * outlineScale
      : 0;
    kerning.push(value);
    advances.push((glyph.advanceWidth / font.unitsPerEm) * 100 * outlineScale);
    previous = glyph;
  }
  return { outline, glyphs, advances, kerning, bounds: outline.bounds };
};
export const hasRequiredGlyphs = (font: opentype.Font, text: string): string | undefined => {
  for (const character of text) {
    if (character === ' ') continue;
    if (font.charToGlyphIndex(character) === 0) return character;
  }
  return undefined;
};
