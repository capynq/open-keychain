import fs from 'node:fs/promises';
import path from 'node:path';
import * as opentype from 'opentype.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { flattenText } from '../text/outline';
import { extrudeFinished } from './edge-finish';
import { createWasm } from './keychain-builder';

let wasm: Awaited<ReturnType<typeof createWasm>>;

const loadBundledFont = async (): Promise<opentype.Font> => {
  const bytes = await fs.readFile(path.join(process.cwd(), 'public', FONT_CATALOG[0].file));
  const parser = (opentype as unknown as { parse: (data: ArrayBuffer) => opentype.Font }).parse;
  return parser(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

beforeAll(async () => {
  wasm = await createWasm();
}, 30000);

describe('extrudeFinished', () => {
  it('keeps the native sharp extrusion fast and exact', () => {
    const section = wasm.CrossSection.square([4000, 3000], true);
    const result = extrudeFinished(wasm, section, 2000, {
      style: 'sharp',
      topMm: 0,
      bottomMm: 0,
    });
    const native = section.extrude(2000);
    expect(result.status()).toBe('NoError');
    expect(result.volume()).toBe(native.volume());
    result.delete();
    native.delete();
    section.delete();
  });

  it('creates a smaller valid finished solid while retaining its dimensions and flat bed', () => {
    const section = wasm.CrossSection.square([4000, 3000], true);
    const sharp = section.extrude(2000);
    const result = extrudeFinished(wasm, section, 2000, {
      style: 'chamfer',
      topMm: 0.3,
      bottomMm: 0,
    });
    const bounds = result.boundingBox();
    expect(result.status()).toBe('NoError');
    expect(result.volume()).toBeLessThan(sharp.volume());
    expect(bounds.min[2]).toBeCloseTo(0, 6);
    expect(bounds.max[2]).toBeCloseTo(2000, 6);
    const components = result.decompose();
    expect(components).toHaveLength(1);
    components.forEach((component) => component.delete());
    result.delete();
    sharp.delete();
    section.delete();
  });

  it.each(['round', 'chamfer'] as const)(
    'keeps %s edge steps measurably distinct and monotonic',
    (style) => {
      const section = wasm.CrossSection.square([8000, 6000], true);
      const low = extrudeFinished(wasm, section, 2400, {
        style,
        topMm: 0.2,
        bottomMm: 0.2,
      });
      const high = extrudeFinished(wasm, section, 2400, {
        style,
        topMm: 0.6,
        bottomMm: 0.6,
      });
      const lowTop = low.slice(2300);
      const highTop = high.slice(2100);
      expect(lowTop.area()).toBeLessThan(section.area());
      expect(highTop.area()).toBeLessThan(lowTop.area());
      expect(low.boundingBox().min[2]).toBeCloseTo(0, 6);
      expect(high.boundingBox().max[2]).toBeCloseTo(2400, 6);
      highTop.delete();
      lowTop.delete();
      high.delete();
      low.delete();
      section.delete();
    },
  );

  it('preserves a counter through a rounded edge finish', () => {
    const outer = wasm.CrossSection.square([6000, 6000], true);
    const hole = wasm.CrossSection.circle(1000, 32);
    const section = outer.subtract(hole);
    const result = extrudeFinished(wasm, section, 2400, {
      style: 'round',
      topMm: 0.3,
      bottomMm: 0.2,
    });
    const middle = result.slice(1200);
    expect(result.status()).toBe('NoError');
    expect(middle.toPolygons()).toHaveLength(2);
    middle.delete();
    result.delete();
    section.delete();
    outer.delete();
    hole.delete();
  });

  it('assigns a counter to only its containing outer contour', () => {
    const leftOuter = wasm.CrossSection.square([3000, 3000], true).translate([-2500, 0]);
    const leftHole = wasm.CrossSection.circle(600, 24).translate([-2500, 0]);
    const left = leftOuter.subtract(leftHole);
    const right = wasm.CrossSection.square([3000, 3000], true).translate([2500, 0]);
    const section = wasm.CrossSection.union([left, right]);
    const result = extrudeFinished(wasm, section, 2000, {
      style: 'round',
      topMm: 0.2,
      bottomMm: 0,
    });
    const middle = result.slice(1000);
    expect(middle.toPolygons()).toHaveLength(3);
    middle.delete();
    result.delete();
    section.delete();
    right.delete();
    left.delete();
    leftHole.delete();
    leftOuter.delete();
  });

  it('finishes an actual bundled-font counter without filling it', async () => {
    const font = await loadBundledFont();
    const outline = flattenText(font, 'O', 4);
    const section = wasm.CrossSection.ofPolygons(
      outline.polygons.map((polygon) =>
        polygon.map(([x, y]) => [x * 1000, y * 1000] as [number, number]),
      ),
      'EvenOdd',
    );
    const result = extrudeFinished(wasm, section, 1200, {
      style: 'round',
      topMm: 0.1,
      bottomMm: 0,
    });
    const middle = result.slice(600);
    expect(middle.toPolygons()).toHaveLength(2);
    middle.delete();
    result.delete();
    section.delete();
  });

  it('rejects a finish that would erase a narrow contour', () => {
    const section = wasm.CrossSection.square([1000, 1000], true);
    expect(() =>
      extrudeFinished(wasm, section, 2000, {
        style: 'round',
        topMm: 0.6,
        bottomMm: 0,
      }),
    ).toThrow('collapse a contour or counter');
    section.delete();
  });
});
