import type {
  CrossSection,
  GeometryWasm,
  Manifold,
} from '../../../infrastructure/geometry/manifold-types';
import type { EdgeFinishValues } from '../model/edge-finish';
import type { EdgeFinish } from '../model/types';

import {
  MANIFOLD_SCALE,
  asMesh,
  validateMesh,
} from '../../../infrastructure/geometry/manifold-utils';
import { EDGE_FINISH_GRID_MM, EDGE_FINISH_TEXT_CLEARANCE_MM } from '../model/edge-finish';

type Point = readonly [number, number];
type Polygons = readonly (readonly Point[])[];
export type TextFinishLimits = { chamferMaxMm: number; roundMaxMm: number };
export type BaseFinishLimits = { chamferMaxMm: number; roundMaxMm: number };
const CHORD_ERROR = 20;
const OVERLAP = 1;
const LIMIT_CACHE_SIZE = 64;
const limitCache = new Map<string, TextFinishLimits>();
const baseLimitCache = new Map<string, BaseFinishLimits>();

/** Consume a solid and remove only machine-resolution, zero-volume Boolean residues.
 * One scaled cubic unit is 1e-9 mm³; every real glyph component is retained.
 */
export const regularizeFinishedSolid = (
  wasm: GeometryWasm,
  solid: Manifold,
  minimumPositiveThicknessScaled = 0,
): Manifold => {
  const components = solid.decompose();
  try {
    const volumetric = components.filter((component) => {
      const volume = component.volume();
      if (Math.abs(volume) <= 1) return false;
      if (volume < 0) return true;
      if (minimumPositiveThicknessScaled === 0) return true;
      const area = component.surfaceArea();
      // Nonlinear nameplate warps can leave detached sub-micron slivers.
      // Retain all cavities and any component without a reliable thickness estimate.
      return (
        !Number.isFinite(area) ||
        area <= 0 ||
        !Number.isFinite(volume) ||
        (2 * volume) / area >= minimumPositiveThicknessScaled
      );
    });
    if (volumetric.length === components.length) return solid;
    if (!volumetric.length) {
      solid.delete();
      throw new Error('Text edge produced an empty solid.');
    }
    const cutters: Manifold[] = [];
    const bodies: Manifold[] = [];
    try {
      // Boolean union treats negative shells as filled solids. Reverse each cavity
      // into a positive cutter and explicitly subtract it from the retained bodies.
      for (const component of volumetric.filter((part) => part.volume() < 0)) {
        const mesh = component.getMesh();
        const indices = new Uint32Array(mesh.triVerts);
        for (let index = 0; index < indices.length; index += 3)
          [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
        const input = new wasm.Mesh({
          numProp: mesh.numProp,
          vertProperties: new Float32Array(mesh.vertProperties),
          triVerts: indices,
          mergeFromVert: new Uint32Array(mesh.mergeFromVert),
          mergeToVert: new Uint32Array(mesh.mergeToVert),
          tolerance: mesh.tolerance,
        });
        cutters.push(new wasm.Manifold(input));
      }
      for (const component of volumetric.filter((part) => part.volume() > 0)) {
        let body = component.translate([0, 0, 0]);
        try {
          for (const cutter of cutters) {
            const overlap = body.intersect(cutter);
            let containsCavity: boolean;
            try {
              containsCavity = overlap.volume() >= cutter.volume() * 0.99999;
            } finally {
              overlap.delete();
            }
            // A positive island inside a cavity remains a separate real body.
            if (!containsCavity) continue;
            const next = body.subtract(cutter);
            body.delete();
            body = next;
          }
          bodies.push(body);
        } catch (error) {
          body.delete();
          throw error;
        }
      }
      const clean = wasm.Manifold.union(bodies);
      solid.delete();
      return clean;
    } catch (error) {
      solid.delete();
      throw error;
    } finally {
      cutters.forEach((cutter) => cutter.delete());
      bodies.forEach((body) => body.delete());
    }
  } finally {
    components.forEach((component) => component.delete());
  }
};

const boundaryDistance = (polygons: Polygons, x: number, y: number): number => {
  let best = Infinity;
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const progress =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(x - a[0] - progress * dx, y - a[1] - progress * dy));
    }
  }
  return best;
};

/** Match each source component to its inset, rather than comparing aggregate polygon counts. */
const assertTopology = (section: CrossSection, inset: CrossSection): void => {
  const original = section.decompose();
  const reduced = inset.decompose();
  try {
    if (original.length !== reduced.length)
      throw new Error('Text edge would collapse a contour or counter.');
    const matched = new Set<number>();
    for (const component of original) {
      const index = reduced.findIndex((candidate, candidateIndex) => {
        if (
          matched.has(candidateIndex) ||
          component.toPolygons().length !== candidate.toPolygons().length
        )
          return false;
        const overlap = component.intersect(candidate);
        try {
          return overlap.area() > candidate.area() * 0.99;
        } finally {
          overlap.delete();
        }
      });
      if (index < 0) throw new Error('Text edge would collapse a contour or counter.');
      matched.add(index);
    }
  } finally {
    original.forEach((component) => component.delete());
    reduced.forEach((component) => component.delete());
  }
};

const segmentCount = (radius: number): number => {
  const angle = 2 * Math.acos(Math.max(-1, 1 - CHORD_ERROR / radius));
  return Math.max(2, Math.min(32, Math.ceil(Math.PI / 2 / angle)));
};

/** Build only the visible top edge with native offset contours and closed, warped bands. */
export const extrudeTextFinished = (
  wasm: GeometryWasm,
  section: CrossSection,
  height: number,
  style: EdgeFinish,
  topMm: number,
  minimumDivisions = 0,
): Manifold => {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(topMm) || topMm < 0)
    throw new Error('Text edge dimensions must be finite and non-negative.');
  if (style === 'sharp' || topMm === 0) return section.extrude(height, minimumDivisions);
  if (style !== 'chamfer' && style !== 'round') throw new Error('Unknown text edge profile.');
  const radius = Math.round(topMm * MANIFOLD_SCALE);
  if (radius >= height) throw new Error('Text edge must be thinner than the relief.');
  const steps = style === 'round' ? segmentCount(radius) : 1;
  const clean = section.simplify(10);
  const sections: CrossSection[] = [];
  const solids: Manifold[] = [];
  const floor = height - radius - OVERLAP;
  try {
    assertTopology(section, clean);
    const offsets = Array.from({ length: steps + 1 }, (_, index) =>
      style === 'round' ? radius * (1 - Math.cos(((index / steps) * Math.PI) / 2)) : index * radius,
    );
    const levels = Array.from({ length: steps + 1 }, (_, index) =>
      style === 'round'
        ? height - radius + radius * Math.sin(((index / steps) * Math.PI) / 2)
        : height - radius + index * radius,
    );
    for (const offset of offsets) {
      const inset = clean.offset(
        -offset,
        'Round',
        2,
        Math.max(4, segmentCount(Math.max(radius, CHORD_ERROR)) * 4),
      );
      sections.push(inset);
      assertTopology(clean, inset);
    }
    solids.push(section.extrude(height - radius, minimumDivisions));
    solids.push(sections[steps].extrude(height, minimumDivisions));
    for (let index = 0; index < steps; index += 1) {
      const outer = sections[index];
      const inner = sections[index + 1];
      const band = outer.subtract(inner);
      const outerPolygons = outer.toPolygons() as Point[][];
      const innerPolygons = inner.toPolygons() as Point[][];
      let slab: Manifold | undefined;
      let warped: Manifold | undefined;
      try {
        const slabHeight = levels[index + 1] - floor;
        slab = band.extrude(slabHeight, minimumDivisions);
        warped = slab.warpBatch((vertices, count) => {
          for (let vertex = 0; vertex < count; vertex += 1) {
            const offset = vertex * 3;
            const x = vertices[offset];
            const y = vertices[offset + 1];
            const fromOuter = boundaryDistance(outerPolygons, x, y);
            const fromInner = boundaryDistance(innerPolygons, x, y);
            const fraction = fromOuter + fromInner === 0 ? 0 : fromOuter / (fromOuter + fromInner);
            const top = levels[index] + fraction * (levels[index + 1] - levels[index]);
            vertices[offset + 2] *= (top - floor) / slabHeight;
          }
        });
        solids.push(warped.translate([0, 0, floor]));
      } finally {
        warped?.delete();
        slab?.delete();
        band.delete();
      }
    }
    const result = regularizeFinishedSolid(wasm, wasm.Manifold.union(solids));
    try {
      if (result.status() !== 'NoError' || result.numTri() === 0 || !validateMesh(asMesh(result)))
        throw new Error('Text edge produced an invalid solid.');
      const upper = result.slice(height - radius / 2);
      try {
        if (section.area() - upper.area() < Math.max(10, section.area() * 0.00001))
          throw new Error('Text edge has no measurable effect.');
      } finally {
        upper.delete();
      }
      return result;
    } catch (error) {
      result.delete();
      throw error;
    }
  } finally {
    solids.forEach((solid) => solid.delete());
    sections.forEach((inset) => inset.delete());
    clean.delete();
  }
};

/** Build the backing with an independent, printer-visible top and bottom profile. */
export const extrudeFinished = (
  wasm: GeometryWasm,
  section: CrossSection,
  height: number,
  finish: Pick<EdgeFinishValues, 'style' | 'topMm' | 'bottomMm'>,
): Manifold => {
  const top = finish.style === 'sharp' ? 0 : Math.round(finish.topMm * MANIFOLD_SCALE);
  const bottom = finish.style === 'sharp' ? 0 : Math.round(finish.bottomMm * MANIFOLD_SCALE);
  if (!Number.isFinite(height) || height <= 0 || top < 0 || bottom < 0 || top + bottom >= height)
    throw new Error('Backing edge dimensions must be finite and leave a printable core.');
  if (finish.style === 'sharp' || (top === 0 && bottom === 0)) return section.extrude(height);
  const bodies: Manifold[] = [];
  try {
    if (top > 0)
      bodies.push(extrudeTextFinished(wasm, section, height, finish.style, finish.topMm));
    else bodies.push(section.extrude(height));
    if (bottom > 0) {
      const mirrored = extrudeTextFinished(wasm, section, height, finish.style, finish.bottomMm);
      const rotated = mirrored.mirror([0, 0, 1]);
      mirrored.delete();
      const placed = rotated.translate([0, 0, height]);
      rotated.delete();
      bodies.push(placed);
    }
    const combined =
      bodies.length === 1 ? bodies[0].translate([0, 0, 0]) : bodies[0].intersect(bodies[1]);
    bodies.forEach((body) => body.delete());
    bodies.length = 0;
    const result = regularizeFinishedSolid(wasm, combined);
    if (result.status() !== 'NoError' || result.numTri() === 0 || !validateMesh(asMesh(result))) {
      result.delete();
      throw new Error('Backing edge produced an invalid solid.');
    }
    return result;
  } catch (error) {
    bodies.forEach((body) => body.delete());
    throw error;
  }
};

/** Verify backing amounts against topology, minimum wall, and raised-text contact. */
export const baseFinishLimits = (
  wasm: GeometryWasm,
  section: CrossSection,
  height: number,
  minimumWallMm: number,
  contacts: readonly CrossSection[] = [],
  exhaustive = true,
): BaseFinishLimits => {
  const maximum = Math.min(2, Math.max(0, (height / MANIFOLD_SCALE - minimumWallMm) / 2));
  const key = JSON.stringify([
    section.toPolygons(),
    height,
    minimumWallMm,
    exhaustive,
    contacts.map((contact) => contact.toPolygons()),
  ]);
  const cached = baseLimitCache.get(key);
  if (cached) return { ...cached };
  const result: BaseFinishLimits = { chamferMaxMm: 0, roundMaxMm: 0 };
  const protectedContacts = contacts.length ? wasm.CrossSection.union(contacts) : undefined;
  try {
    for (const style of ['chamfer', 'round'] as const) {
      const steps = exhaustive
        ? Math.floor(maximum / EDGE_FINISH_GRID_MM + 1e-8)
        : Math.min(1, Math.floor(maximum / EDGE_FINISH_GRID_MM + 1e-8));
      for (let step = 1; step <= steps; step += 1) {
        const amount = Number((step * EDGE_FINISH_GRID_MM).toFixed(1));
        let solid: Manifold | undefined;
        let slice: CrossSection | undefined;
        try {
          solid = extrudeFinished(wasm, section, height, {
            style,
            topMm: amount,
            bottomMm: amount,
          });
          if (protectedContacts) {
            slice = solid.slice(height - 150);
            const unsupported = protectedContacts.subtract(slice);
            try {
              if (unsupported.area() > 10) break;
            } finally {
              unsupported.delete();
            }
          }
          result[style === 'chamfer' ? 'chamferMaxMm' : 'roundMaxMm'] = amount;
        } catch {
          break;
        } finally {
          slice?.delete();
          solid?.delete();
        }
      }
    }
  } finally {
    protectedContacts?.delete();
  }
  if (baseLimitCache.size >= LIMIT_CACHE_SIZE)
    baseLimitCache.delete(baseLimitCache.keys().next().value!);
  baseLimitCache.set(key, result);
  return { ...result };
};

export const assertBaseFinishAmount = (
  style: EdgeFinish,
  topMm: number,
  bottomMm: number,
  limits: BaseFinishLimits,
  heightMm: number,
  minimumWallMm: number,
): void => {
  if (style === 'sharp' && (topMm !== 0 || bottomMm !== 0))
    throw new Error('Sharp backing edges cannot have a finish amount.');
  const maximum = style === 'chamfer' ? limits.chamferMaxMm : limits.roundMaxMm;
  if (style !== 'sharp' && (topMm > maximum + 1e-8 || bottomMm > maximum + 1e-8))
    throw new Error('Backing edge is too large for this foundation.');
  if (topMm + bottomMm > heightMm - minimumWallMm + 1e-8)
    throw new Error('Backing edge leaves too little wall thickness.');
};

/** Verify consecutive printer-visible amounts, caching values only (never WASM objects). */
export const textFinishLimits = (
  wasm: GeometryWasm,
  section: CrossSection,
  height: number,
  visibleDepthMm: number,
  exhaustive = true,
): TextFinishLimits => {
  const heightMaximum = Math.floor(
    Math.min(1, visibleDepthMm - EDGE_FINISH_TEXT_CLEARANCE_MM) / EDGE_FINISH_GRID_MM + 1e-8,
  );
  // Sharp edits verify only the initial selectable amount. Expand on a finish request.
  const maximum = exhaustive ? heightMaximum : Math.min(1, heightMaximum);
  const key = JSON.stringify([section.toPolygons(), height, maximum]);
  const cached = limitCache.get(key);
  if (cached) return { ...cached };
  const result: TextFinishLimits = { chamferMaxMm: 0, roundMaxMm: 0 };
  for (const style of ['chamfer', 'round'] as const) {
    for (let step = 1; step <= maximum; step += 1) {
      const amount = Number((step * EDGE_FINISH_GRID_MM).toFixed(1));
      let solid: Manifold | undefined;
      try {
        solid = extrudeTextFinished(wasm, section, height, style, amount);
        result[style === 'chamfer' ? 'chamferMaxMm' : 'roundMaxMm'] = amount;
      } catch {
        break;
      } finally {
        solid?.delete();
      }
    }
  }
  if (limitCache.size >= LIMIT_CACHE_SIZE) limitCache.delete(limitCache.keys().next().value!);
  limitCache.set(key, result);
  return { ...result };
};

export const intersectTextFinishLimits = (
  limits: readonly TextFinishLimits[],
): TextFinishLimits => ({
  chamferMaxMm: limits.length ? Math.min(...limits.map((limit) => limit.chamferMaxMm)) : 0,
  roundMaxMm: limits.length ? Math.min(...limits.map((limit) => limit.roundMaxMm)) : 0,
});

export const assertTextFinishAmount = (
  style: EdgeFinish,
  amount: number,
  limits: TextFinishLimits,
): void => {
  if (
    style !== 'sharp' &&
    amount > (style === 'chamfer' ? limits.chamferMaxMm : limits.roundMaxMm) + 1e-8
  )
    throw new Error('Text edge is too large for these letters. Increase text size.');
};
