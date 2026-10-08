import fs from 'node:fs/promises';
import path from 'node:path';
import * as opentype from 'opentype.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { flattenText } from '../text/outline';
import {
  extrudeTextFinished,
  extrudeFinished,
  baseFinishLimits,
  assertBaseFinishAmount,
  textFinishLimits,
  assertTextFinishAmount,
  regularizeFinishedSolid,
} from './edge-finish';
import { createWasm } from './keychain-builder';

let wasm: Awaited<ReturnType<typeof createWasm>>;
beforeAll(async () => {
  wasm = await createWasm();
}, 30000);
const textSection = async (id: string, text: string, size = 22) => {
  const definition = FONT_CATALOG.find((font) => font.id === id)!;
  const bytes = await fs.readFile(path.join(process.cwd(), 'public', definition.file));
  const parser = (opentype as unknown as { parse: (data: ArrayBuffer) => opentype.Font }).parse;
  const outline = flattenText(
    parser(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    text,
    size,
  );
  const raw = wasm.CrossSection.ofPolygons(
    outline.polygons.map((polygon) =>
      polygon.map(([x, y]) => [x * 1000, y * 1000] as [number, number]),
    ),
    'EvenOdd',
  );
  // Match the default visible text weight used by the reproduced Customizer name.
  if (text === 'ALEX') {
    const weighted = raw.offset(600, 'Round', 2, 64);
    raw.delete();
    return weighted;
  }
  return raw;
};

describe('native front text finishing', () => {
  it.each(['chamfer', 'round'] as const)(
    'keeps backing volume and bounds with a %s profile',
    (style) => {
      const section = wasm.CrossSection.square([4000, 3000], true);
      const sharp = section.extrude(2400);
      const finished = extrudeFinished(wasm, section, 2400, {
        style,
        topMm: 0.2,
        bottomMm: 0.2,
      });
      try {
        expect(finished.status()).toBe('NoError');
        expect(finished.boundingBox().max[2]).toBe(2400);
        expect(finished.boundingBox().min[2]).toBe(0);
        expect(finished.volume()).toBeLessThan(sharp.volume());
      } finally {
        finished.delete();
        sharp.delete();
        section.delete();
      }
    },
  );

  it('preserves an asymmetric footprint while finishing both backing faces', () => {
    const section = wasm.CrossSection.ofPolygons(
      [
        [
          [0, 0],
          [5000, 0],
          [3500, 2800],
          [0, 1800],
        ],
      ],
      'EvenOdd',
    );
    const sharp = section.extrude(2400);
    const finished = extrudeFinished(wasm, section, 2400, {
      style: 'chamfer',
      topMm: 0.2,
      bottomMm: 0.2,
    });
    try {
      const expected = sharp.boundingBox();
      const actual = finished.boundingBox();
      expect(actual.min[0]).toBeCloseTo(expected.min[0]);
      expect(actual.max[0]).toBeCloseTo(expected.max[0]);
      expect(actual.min[1]).toBeCloseTo(expected.min[1]);
      expect(actual.max[1]).toBeCloseTo(expected.max[1]);
      expect(actual.min[2]).toBe(0);
      expect(actual.max[2]).toBe(2400);
    } finally {
      finished.delete();
      sharp.delete();
      section.delete();
    }
  });

  it('verifies backing amounts against wall thickness and protected contact', () => {
    const section = wasm.CrossSection.square([8000, 6000], true);
    const contact = wasm.CrossSection.square([3000, 2000], true);
    try {
      const limits = baseFinishLimits(wasm, section, 2400, 1.2, [contact], false);
      expect(limits).toEqual({ chamferMaxMm: 0.2, roundMaxMm: 0.2 });
      expect(() => assertBaseFinishAmount('chamfer', 0.2, 0.2, limits, 2.4, 1.2)).not.toThrow();
      expect(() => assertBaseFinishAmount('chamfer', 0.4, 0.4, limits, 2.4, 1.2)).toThrow();
    } finally {
      contact.delete();
      section.delete();
    }
  });

  it('removes only sub-micron positive warp slivers and retains cavities and real thin components', () => {
    const outer = wasm.Manifold.cube([1000, 1000, 1000]);
    const cavityRaw = wasm.Manifold.cube([400, 400, 400]);
    const cavity = cavityRaw.translate([300, 300, 300]);
    const shell = outer.subtract(cavity);
    const sliverRaw = wasm.Manifold.cube([1000, 1000, 0.4]);
    const sliver = sliverRaw.translate([2000, 0, 0]);
    const realRaw = wasm.Manifold.cube([1000, 1000, 10]);
    const real = realRaw.translate([4000, 0, 0]);
    const input = wasm.Manifold.union([shell, sliver, real]);
    const result = regularizeFinishedSolid(wasm, input, 1);
    const parts = result.decompose();
    try {
      expect(parts.filter((part) => part.volume() > 0)).toHaveLength(2);
      const emptyCavity = result.intersect(cavity);
      try {
        expect(Math.abs(emptyCavity.volume())).toBeLessThan(1);
      } finally {
        emptyCavity.delete();
      }
      expect(result.volume()).toBeCloseTo(shell.volume() + real.volume(), 2);
    } finally {
      [result, ...parts, outer, cavityRaw, cavity, shell, sliverRaw, sliver, realRaw, real].forEach(
        (solid) => solid.delete(),
      );
    }
  });

  it('checks only the starting amount for sharp edits and expands for a finish request', () => {
    const section = wasm.CrossSection.square([4000, 4000]);
    try {
      expect(textFinishLimits(wasm, section, 1200, 1, false)).toEqual({
        chamferMaxMm: 0.2,
        roundMaxMm: 0.2,
      });
      expect(textFinishLimits(wasm, section, 1200, 1)).toEqual({
        chamferMaxMm: 0.8,
        roundMaxMm: 0.8,
      });
    } finally {
      section.delete();
    }
  });

  it('retains a real positive island inside a cleaned cavity', () => {
    const outer = wasm.Manifold.cube([1000, 1000, 1000]);
    const cavityRaw = wasm.Manifold.cube([600, 600, 600]);
    const cavity = cavityRaw.translate([200, 200, 200]);
    const shell = outer.subtract(cavity);
    const islandRaw = wasm.Manifold.cube([200, 200, 200]);
    const island = islandRaw.translate([400, 400, 400]);
    const sliverRaw = wasm.Manifold.cube([1000, 1000, 0.4]);
    const sliver = sliverRaw.translate([2000, 0, 0]);
    const result = regularizeFinishedSolid(wasm, wasm.Manifold.union([shell, island, sliver]), 1);
    const inside = result.intersect(cavity);
    try {
      expect(inside.volume()).toBeCloseTo(island.volume(), 2);
      expect(result.volume()).toBeCloseTo(shell.volume() + island.volume(), 2);
    } finally {
      [
        outer,
        cavityRaw,
        cavity,
        shell,
        islandRaw,
        island,
        sliverRaw,
        sliver,
        result,
        inside,
      ].forEach((solid) => solid.delete());
    }
  });
  it('keeps sharp extrusion exact', () => {
    const section = wasm.CrossSection.square([4000, 3000], true);
    const native = section.extrude(2000);
    const result = extrudeTextFinished(wasm, section, 2000, 'sharp', 0);
    try {
      expect(result.volume()).toBe(native.volume());
    } finally {
      result.delete();
      native.delete();
      section.delete();
    }
  });

  it.each(['chamfer', 'round'] as const)(
    'preserves the lower section and counters with a %s front edge',
    async (style) => {
      const section = await textSection('nunito', 'O');
      const result = extrudeTextFinished(wasm, section, 1200, style, 0.4);
      const lower = result.slice(400);
      const upperRaw = result.slice(1199);
      // Slice intersections include zero-area floating-point loops; regularize below 0.001 mm.
      const upper = upperRaw.simplify(1);
      upperRaw.delete();
      try {
        expect(result.status()).toBe('NoError');
        expect(lower.area()).toBeCloseTo(section.area(), 1);
        expect(lower.toPolygons()).toHaveLength(section.toPolygons().length);
        expect(upper.toPolygons()).toHaveLength(section.toPolygons().length);
        expect(upper.area()).toBeLessThan(lower.area());
        expect(result.boundingBox().min[2]).toBe(0);
        expect(result.boundingBox().max[2]).toBe(1200);
      } finally {
        upper.delete();
        lower.delete();
        result.delete();
        section.delete();
      }
    },
  );

  it.each(['chamfer', 'round'] as const)(
    'bounds the failing ALEX 0.6/0.8 mm %s cases without constructing a non-manifold mesh',
    async (style) => {
      const section = await textSection('nunito', 'ALEX');
      try {
        const limits = textFinishLimits(wasm, section, 1150, 1);
        const maximum = style === 'chamfer' ? limits.chamferMaxMm : limits.roundMaxMm;
        expect(maximum).toBeGreaterThanOrEqual(0.2);
        for (const amount of [0.2, 0.4, 0.6, 0.8]) {
          if (amount <= maximum) {
            const result = extrudeTextFinished(wasm, section, 1150, style, amount);
            expect(result.status()).toBe('NoError');
            result.delete();
          } else expect(() => assertTextFinishAmount(style, amount, limits)).toThrow('too large');
        }
        expect(textFinishLimits(wasm, section, 1150, 1)).toEqual(limits);
      } finally {
        section.delete();
      }
    },
  );

  it.each(['nunito', 'marck-script', 'amatic-sc', 'bungee'])(
    'exposes only validated amounts for %s counters and thin strokes',
    async (fontId) => {
      const section = await textSection(fontId, 'ABOe');
      try {
        const limits = textFinishLimits(wasm, section, 1150, 1);
        for (const style of ['chamfer', 'round'] as const) {
          const maximum = style === 'chamfer' ? limits.chamferMaxMm : limits.roundMaxMm;
          for (let amount = 0.2; amount <= maximum + 1e-8; amount += 0.2) {
            const result = extrudeTextFinished(wasm, section, 1150, style, amount);
            expect(result.status()).toBe('NoError');
            result.delete();
          }
        }
      } finally {
        section.delete();
      }
    },
    15_000,
  );

  it('does not expose a radius that removes a narrow component', () => {
    const section = wasm.CrossSection.square([300, 1000], true);
    try {
      expect(textFinishLimits(wasm, section, 1200, 1)).toEqual({ chamferMaxMm: 0, roundMaxMm: 0 });
      expect(() => extrudeTextFinished(wasm, section, 1200, 'round', 0.2)).toThrow('collapse');
    } finally {
      section.delete();
    }
  });
});
