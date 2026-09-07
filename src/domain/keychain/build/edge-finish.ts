import { ExtrudeGeometry, Path, Shape } from 'three';

import type {
  CrossSection,
  GeometryWasm,
  Manifold,
} from '../../../infrastructure/geometry/manifold-types';

import { MANIFOLD_SCALE } from '../../../infrastructure/geometry/manifold-utils';

export type EdgeFinish = {
  style: 'sharp' | 'chamfer' | 'round';
  /** Millimetres at the public builder boundary. */
  topMm: number;
  /** Millimetres at the public builder boundary. */
  bottomMm: number;
};

type Point = readonly [number, number];

const MAX_BEVEL_SEGMENTS = 32;
/** All geometry entering this module is in Manifold's 1/1000 mm units. */
const MAX_CHORD_ERROR_SCALED = 20;

const polygonArea = (polygon: readonly Point[]): number =>
  polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;

const contains = (polygon: readonly Point[], [x, y]: Point): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [leftX, leftY] = polygon[index];
    const [rightX, rightY] = polygon[previous];
    if (leftY > y !== rightY > y && x < ((rightX - leftX) * (y - leftY)) / (rightY - leftY) + leftX)
      inside = !inside;
  }
  return inside;
};

const appendPolygon = (path: Path, polygon: readonly Point[]): void => {
  const [first, ...rest] = polygon;
  if (!first) throw new Error('Edge finishing requires polygons with at least three vertices.');
  path.moveTo(first[0], first[1]);
  for (const point of rest) path.lineTo(point[0], point[1]);
  path.closePath();
};

/** Convert Manifold's signed outer/counter contours to Three.js Shapes without losing counters. */
const shapesFor = (section: CrossSection): Shape[] => {
  const polygons = section.toPolygons().map((polygon) => polygon as Point[]);
  const outers = polygons.filter((polygon) => polygonArea(polygon) > 0);
  const holes = polygons.filter((polygon) => polygonArea(polygon) < 0);
  if (!outers.length) throw new Error('Edge finishing requires at least one outer contour.');
  return outers.map((outer) => {
    const shape = new Shape();
    appendPolygon(shape, outer);
    for (const hole of holes) {
      if (!contains(outer, hole[0])) continue;
      const path = new Path();
      appendPolygon(path, hole);
      shape.holes.push(path);
    }
    return shape;
  });
};

const bevelSegments = (style: EdgeFinish['style'], radius: number): number => {
  if (style === 'chamfer') return 1;
  if (radius <= MAX_CHORD_ERROR_SCALED) return 1;
  const angle = 2 * Math.acos(1 - MAX_CHORD_ERROR_SCALED / radius);
  return Math.min(MAX_BEVEL_SEGMENTS, Math.max(1, Math.ceil(Math.PI / 2 / angle)));
};

const componentSignature = (section: CrossSection): string[] => {
  const components = section.decompose();
  try {
    return components
      .map((component) => String(component.toPolygons().length))
      .sort((left, right) => Number(left) - Number(right));
  } finally {
    components.forEach((component) => component.delete());
  }
};

const assertInsetTopology = (section: CrossSection, radius: number): void => {
  if (radius <= 0) return;
  const original = componentSignature(section);
  const inset = section.offset(-radius, 'Round', 2, bevelSegments('round', radius));
  try {
    if (componentSignature(inset).join(',') !== original.join(','))
      throw new Error('Edge finish would collapse a contour or counter.');
  } finally {
    inset.delete();
  }
};

/**
 * A finished edge must be measurable in a horizontal section, not merely have
 * different tessellation. This catches bevel configurations that collapse to a
 * visually sharp edge after boolean cleanup.
 */
const assertProfileEffect = (
  section: CrossSection,
  solid: Manifold,
  height: number,
  topRadius: number,
  bottomRadius: number,
): void => {
  const sourceArea = section.area();
  const minimumAreaDelta = Math.max(10, sourceArea * 0.00001);
  const assertSide = (radius: number, z: number, side: 'top' | 'bottom'): void => {
    if (radius <= 0) return;
    const slice = solid.slice(z);
    try {
      if (sourceArea - slice.area() < minimumAreaDelta)
        throw new Error(`Edge finish ${side} profile has no measurable effect.`);
    } finally {
      slice.delete();
    }
  };
  assertSide(topRadius, height - topRadius / 2, 'top');
  assertSide(bottomRadius, bottomRadius / 2, 'bottom');
};

const manifoldFromThree = (
  wasm: GeometryWasm,
  shapes: Shape[],
  height: number,
  radius: number,
  segments: number,
): Manifold => {
  const geometry = new ExtrudeGeometry(shapes, {
    bevelEnabled: true,
    bevelOffset: -radius,
    bevelSegments: segments,
    bevelSize: radius,
    bevelThickness: radius,
    curveSegments: 1,
    depth: height - radius,
    steps: 1,
  });
  try {
    const positions = geometry.getAttribute('position');
    if (!positions || positions.count === 0 || positions.count % 3 !== 0)
      throw new Error('Edge finish did not produce a complete triangle mesh.');
    const mesh = new wasm.Mesh({
      numProp: 3,
      triVerts: Uint32Array.from({ length: positions.count }, (_, index) => index),
      vertProperties: new Float32Array(positions.array),
    });
    mesh.merge();
    const manifold = new wasm.Manifold(mesh);
    if (manifold.status() !== 'NoError') {
      manifold.delete();
      throw new Error('Edge finish produced a non-manifold solid.');
    }
    return manifold;
  } finally {
    geometry.dispose();
  }
};

/**
 * Extrude in Manifold units with a flat printable base and optional planar
 * chamfer/round finishes. The sharp path intentionally stays native.
 */
export const extrudeFinished = (
  wasm: GeometryWasm,
  section: CrossSection,
  height: number,
  finish: EdgeFinish,
): Manifold => {
  if (!Number.isFinite(height) || height <= 0)
    throw new Error('Extrusion height must be positive.');
  const { topMm, bottomMm, style } = finish;
  if (
    !Number.isFinite(topMm) ||
    !Number.isFinite(bottomMm) ||
    topMm < 0 ||
    bottomMm < 0 ||
    (topMm + bottomMm) * MANIFOLD_SCALE >= height
  ) {
    throw new Error('Edge finishes must be non-negative and thinner than the solid.');
  }
  if (style === 'sharp') {
    if (topMm !== 0 || bottomMm !== 0)
      throw new Error('Sharp edge finish cannot be combined with a non-zero edge radius.');
    return section.extrude(height);
  }
  if (topMm === 0 && bottomMm === 0) return section.extrude(height);
  if (style !== 'chamfer' && style !== 'round') throw new Error('Unknown edge finish.');

  const topRadius = Math.round(topMm * MANIFOLD_SCALE);
  const bottomRadius = Math.round(bottomMm * MANIFOLD_SCALE);
  const radius = Math.max(topRadius, bottomRadius);
  assertInsetTopology(section, radius);
  const shapes = shapesFor(section);
  const createTop = (edgeRadius: number): Manifold => {
    if (edgeRadius === 0) return section.extrude(height);
    const raw = manifoldFromThree(
      wasm,
      shapes,
      height,
      edgeRadius,
      bevelSegments(style, edgeRadius),
    );
    try {
      return raw.trimByPlane([0, 0, 1], 0);
    } finally {
      raw.delete();
    }
  };
  let top: Manifold | undefined;
  let bottom: Manifold | undefined;
  try {
    top = createTop(topRadius);
    const bottomSource = createTop(bottomRadius);
    try {
      const mirrored = bottomSource.scale([1, 1, -1]);
      try {
        bottom = mirrored.translate([0, 0, height]);
      } finally {
        mirrored.delete();
      }
    } finally {
      bottomSource.delete();
    }
    const result = top.intersect(bottom);
    if (result.status() !== 'NoError' || result.numTri() === 0) {
      result.delete();
      throw new Error('Edge finish produced an invalid or empty solid.');
    }
    try {
      assertProfileEffect(section, result, height, topRadius, bottomRadius);
    } catch (error) {
      result.delete();
      throw error;
    }
    return result;
  } finally {
    top?.delete();
    bottom?.delete();
  }
};
