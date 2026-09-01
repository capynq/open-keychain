import type { CrossSection, GeometryWasm } from '../../../infrastructure/geometry/manifold-types';
import type { GeometryConstraints, PrintProfile, StyleId, TemplateId } from '../model/types';
import type { GlyphOutline } from '../text/outline';

import { sectionArea } from '../../../infrastructure/geometry/manifold-utils';
export type Vec2 = [number, number];
const MAGNET_DIMENSIONS = {
  '6x2': [6, 2],
  '8x2': [8, 2],
  '10x3': [10, 3],
  '12x3': [12, 3],
  '15x3': [15, 3],
} as const;
const BASELINE_MARGIN = 2.4 * 1000;
export type Bounds2 = {
  min: Vec2;
  max: Vec2;
};
export type StyleInput = {
  text: CrossSection;
  textBounds: Bounds2;
  padding: number;
  /** Distance between the relief contour and its surrounding backing, in scaled units. */
  textInset?: number;
  letterSpacing?: number;
  holeDiameter: number;
  keyringWall: number;
  templateId?: TemplateId;
  connectorWidth?: number;
  cornerRadius?: number;
  stakeLength?: number;
  plantAccentEnabled?: boolean;
  nameplateTiltDeg?: number;
  nameplateEmbedMm?: number;
  glyphs?: GlyphOutline[];
  baseThickness?: number;
  reliefDepth?: number;
  jointClearance?: number;
  mechanicalGap?: number;
  maxJointAngleDeg?: number;
  minimumWall?: number;
  bottomClearance?: number;
  /** Millimetres of 2D dilation applied to articulated glyphs before extrusion. */
  articulatedOutlineExpansionMm?: number;
  constraints?: GeometryConstraints;
  printProfile?: PrintProfile;
  reliefHaloMm?: number;
  ringOffsetMm?: number;
  bubbleLobeMm?: number;
  tagTailMm?: number;
  archCurveMm?: number;
  stakeShoulderMm?: number;
  jointBossMm?: number;
  ribbonTailMm?: number;
  ribbonNotchMm?: number;
  subtitle?: CrossSection;
  magnetPocketPreset?: '6x2' | '8x2' | '10x3' | '12x3' | '15x3';
  magnetPocketPlacement?: 'center' | 'upper' | 'lower' | 'left' | 'right';
};
export type StyleBuild = {
  backing: CrossSection;
  relief: CrossSection;
  subtitle?: CrossSection;
  recesses?: Array<{
    section: CrossSection;
    depthMm: number;
  }>;
  rearRecesses?: Array<{ section: CrossSection; depthMm: number }>;
  magnetPocket?: {
    preset: '6x2' | '8x2' | '10x3' | '12x3' | '15x3';
    placement: 'center' | 'upper' | 'lower' | 'left' | 'right';
    diameterMm: number;
    depthMm: number;
    centerMm: Vec2;
    adjusted: boolean;
    safe: boolean;
  };
  /** Optional template-specific cap depth in millimetres. */
  reliefDepthMm?: number;
  constraints?: GeometryConstraints;
  printProfile?: PrintProfile;
};

const magnetPocket = (
  wasm: GeometryWasm,
  plate: CrossSection,
  input: StyleInput,
): { section: CrossSection; centerMm: Vec2; adjusted: boolean; safe: boolean } => {
  const preset = input.magnetPocketPreset ?? '10x3';
  const [diameter] = MAGNET_DIMENSIONS[preset];
  const radius = (diameter / 2) * 1000;
  const clearance = 1.2 * 1000;
  const bounds = sectionBounds(plate);
  const xLimit = Math.max(0, (bounds.max[0] - bounds.min[0]) / 2 - radius - clearance);
  const yLimit = Math.max(0, (bounds.max[1] - bounds.min[1]) / 2 - radius - clearance);
  const placement = input.magnetPocketPlacement ?? 'center';
  const requestedX =
    placement === 'left' ? -xLimit * 0.6 : placement === 'right' ? xLimit * 0.6 : 0;
  const requestedY =
    placement === 'upper' ? yLimit * 0.6 : placement === 'lower' ? -yLimit * 0.6 : 0;
  const clampedRequested: Vec2 = [
    Math.max(-xLimit, Math.min(xLimit, requestedX)),
    Math.max(-yLimit, Math.min(yLimit, requestedY)),
  ];
  const isSafe = (point: Vec2): boolean => {
    const envelope = wasm.CrossSection.circle(radius + clearance, 64).translate(point);
    const outside = envelope.subtract(plate);
    const safe = sectionArea(outside) <= 10_000;
    envelope.delete();
    outside.delete();
    return safe;
  };
  const candidates: Vec2[] = [clampedRequested, [0, 0]];
  for (let row = -2; row <= 2; row += 1)
    for (let column = -2; column <= 2; column += 1)
      candidates.push([(column / 2) * xLimit, (row / 2) * yLimit]);
  const safeCandidates = candidates.filter(isSafe);
  const point = safeCandidates.sort(
    (left, right) =>
      (left[0] - clampedRequested[0]) ** 2 +
      (left[1] - clampedRequested[1]) ** 2 -
      ((right[0] - clampedRequested[0]) ** 2 + (right[1] - clampedRequested[1]) ** 2),
  )[0] ?? [0, 0];
  const x = point[0];
  const y = point[1];
  return {
    section: wasm.CrossSection.circle(radius, 64).translate([x, y]),
    centerMm: [x / 1000, y / 1000],
    adjusted:
      safeCandidates.length === 0 ||
      Math.abs(x - requestedX) > 0.01 ||
      Math.abs(y - requestedY) > 0.01,
    safe: safeCandidates.length > 0 || (xLimit > 0 && yLimit > 0),
  };
};
export const roundedRect = (
  wasm: GeometryWasm,
  width: number,
  height: number,
  radius: number,
): CrossSection => {
  const innerWidth = Math.max(100, width - radius * 2);
  const innerHeight = Math.max(100, height - radius * 2);
  return wasm.CrossSection.square([innerWidth, innerHeight], true).offset(radius, 'Round', 2, 64);
};
export const union = (wasm: GeometryWasm, sections: CrossSection[]): CrossSection => {
  return wasm.CrossSection.union(sections);
};
export const sectionBounds = (section: CrossSection): Bounds2 => {
  const bounds = section.bounds();
  return { min: [bounds.min[0], bounds.min[1]], max: [bounds.max[0], bounds.max[1]] };
};
/** Apply the Arch style's shared upward curve to a relief section. */
export const archWarp = (
  section: CrossSection,
  textBounds: Bounds2,
  archCurveMm = 0,
): CrossSection => {
  const textWidth = textBounds.max[0] - textBounds.min[0];
  const textHeight = textBounds.max[1] - textBounds.min[1];
  const centerX = (textBounds.min[0] + textBounds.max[0]) / 2;
  const amplitude =
    Math.max(1500, Math.min(5000, textHeight * 0.18)) + Math.max(0, archCurveMm) * 1000;
  return section.warp((point: Vec2) => {
    const normalized = (point[0] - centerX) / (textWidth / 2);
    point[1] += amplitude * (1 - normalized * normalized);
  });
};
export const capsule = (
  wasm: GeometryWasm,
  start: Vec2,
  end: Vec2,
  width: number,
): CrossSection => {
  const radius = width / 2;
  const startCap = wasm.CrossSection.circle(radius, 64).translate(start);
  const endCap = wasm.CrossSection.circle(radius, 64).translate(end);
  const result = wasm.CrossSection.hull([startCap, endCap]);
  startCap.delete();
  endCap.delete();
  return result;
};
const horizontalIntervals = (polygons: Vec2[][], y: number): Array<[number, number]> => {
  const intersections: number[] = [];
  for (const polygon of polygons)
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if ((start[1] <= y && end[1] > y) || (end[1] <= y && start[1] > y)) {
        intersections.push(start[0] + ((y - start[1]) * (end[0] - start[0])) / (end[1] - start[1]));
      }
    }
  intersections.sort((left, right) => left - right);
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index + 1 < intersections.length; index += 2)
    intervals.push([intersections[index], intersections[index + 1]]);
  return intervals;
};
const attachmentAnchor = (
  section: CrossSection,
  minimumSpan: number,
  side: 'left' | 'right',
): Vec2 => {
  const bounds = sectionBounds(section);
  const polygons = section.toPolygons() as Vec2[][];
  const height = bounds.max[1] - bounds.min[1];
  let best:
    | {
        point: Vec2;
        width: number;
        edge: number;
      }
    | undefined;
  for (let index = 0; index < 17; index += 1) {
    const y = bounds.min[1] + height * (0.24 + index * 0.0325);
    const intervals = horizontalIntervals(polygons, y);
    const viable = intervals.filter(([start, end]) => end - start >= minimumSpan);
    const candidates = viable.length ? viable : intervals;
    for (const [start, end] of candidates) {
      const width = end - start;
      const edge = Math.min(y - bounds.min[1], bounds.max[1] - y);
      const x = side === 'left' ? start : end;
      const isFartherOut =
        side === 'left'
          ? x < (best?.point[0] ?? Infinity) - 0.01
          : x > (best?.point[0] ?? -Infinity) + 0.01;
      if (
        !best ||
        isFartherOut ||
        (Math.abs(x - best.point[0]) < 0.01 && (width > best.width || edge > best.edge))
      ) {
        best = { point: [x, y], width, edge };
      }
    }
  }
  return (
    best?.point ?? [
      side === 'left' ? bounds.min[0] : bounds.max[0],
      (bounds.min[1] + bounds.max[1]) / 2,
    ]
  );
};
/** Attach a keyring tab with a deliberately overlapping root, preserving the counter opening. */
export const ringAssembly = (
  wasm: GeometryWasm,
  base: CrossSection,
  holeDiameter: number,
  wall: number,
  side: 'left' | 'right' = 'left',
  offsetMm = 0,
): CrossSection => {
  const bounds = sectionBounds(base);
  const outerRadius = holeDiameter / 2 + wall;
  const overlap = Math.max(5000, wall * 2);
  const rootWidth = Math.max(6000, wall * 2.5);
  const anchor = attachmentAnchor(base, Math.max(wall, 3200), side);
  const x =
    side === 'left'
      ? anchor[0] - outerRadius + Math.min(1600, outerRadius * 0.34)
      : anchor[0] + outerRadius - Math.min(1600, outerRadius * 0.34);
  const center: Vec2 = [x, anchor[1] + offsetMm * 1000];
  const outer = wasm.CrossSection.circle(outerRadius, 96).translate(center);
  const rootHeight = Math.min(
    bounds.max[1] - bounds.min[1],
    Math.max(wall * 2.7, outerRadius * 1.45),
  );
  const root = roundedRect(wasm, rootWidth + overlap, rootHeight, rootHeight / 2).translate([
    side === 'left' ? anchor[0] - (rootWidth - overlap) / 2 : anchor[0] + (rootWidth - overlap) / 2,
    anchor[1],
  ]);
  const tabOuter = wasm.CrossSection.hull([outer, root]);
  const hole = wasm.CrossSection.circle(holeDiameter / 2, 96).translate(center);
  const tab = tabOuter.subtract(hole);
  const result = union(wasm, [base, tab]);
  outer.delete();
  root.delete();
  tabOuter.delete();
  hole.delete();
  tab.delete();
  return result;
};
const plateStyle = (wasm: GeometryWasm, input: StyleInput, radius: number): CrossSection => {
  const textInset = effectiveMargin(input);
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  const width = Math.max(34000, textWidth + textInset * 2 + 6000);
  const height = Math.max(18000, textHeight + textInset * 2);
  return roundedRect(wasm, width, height, radius);
};
/**
 * Resolve the material margin around the relief while retaining the historic
 * default footprint. Each control contributes its delta from the 2.4 mm
 * baseline, so changing either one still has a visible, predictable effect.
 */
export const effectiveMargin = (input: StyleInput): number =>
  Math.max(600, input.padding + Math.max(0, input.textInset ?? 0) - BASELINE_MARGIN);
export const finishStyle = (
  wasm: GeometryWasm,
  backing: CrossSection,
  relief: CrossSection,
  input: StyleInput,
  side: 'left' | 'right',
  recesses?: Array<{
    section: CrossSection;
    depthMm: number;
  }>,
  attachKeyring = true,
): StyleBuild => {
  const textInset = effectiveMargin(input);
  const reliefHalo = Math.max(0, input.reliefHaloMm ?? 0) * 1000;
  const supportOffset = Math.max(600, Math.min(textInset + reliefHalo, 1200 + reliefHalo));
  const support = relief.offset(supportOffset, 'Round', 2, 64);
  const subtitleSupport = input.subtitle
    ? input.subtitle.offset(supportOffset, 'Round', 2, 64)
    : undefined;
  const joined = union(
    wasm,
    subtitleSupport ? [backing, support, subtitleSupport] : [backing, support],
  );
  const combined = joined.simplify(20);
  backing.delete();
  support.delete();
  subtitleSupport?.delete();
  joined.delete();
  const result = attachKeyring
    ? ringAssembly(
        wasm,
        combined,
        input.holeDiameter,
        input.keyringWall,
        side,
        input.ringOffsetMm ?? 0,
      )
    : combined;
  if (result !== combined) combined.delete();
  return { backing: result, relief, subtitle: input.subtitle, recesses };
};
const finishMagnetStyle = (
  wasm: GeometryWasm,
  backing: CrossSection,
  relief: CrossSection,
  input: StyleInput,
  side: 'left' | 'right',
  recesses?: Array<{ section: CrossSection; depthMm: number }>,
): StyleBuild => {
  let magnetBacking = backing;
  if (input.subtitle) {
    const subtitleSupport = input.subtitle.offset(
      Math.max(600, Math.min(effectiveMargin(input), 1200)),
      'Round',
      2,
      64,
    );
    const joined = union(wasm, [magnetBacking, subtitleSupport]).simplify(20);
    magnetBacking.delete();
    subtitleSupport.delete();
    magnetBacking = joined;
  }
  const finished = finishStyle(wasm, magnetBacking, relief, input, side, recesses, false);
  const pocket = magnetPocket(wasm, finished.backing, input);
  const preset = input.magnetPocketPreset ?? '10x3';
  const dimensions = MAGNET_DIMENSIONS[preset];
  return {
    ...finished,
    subtitle: input.subtitle,
    rearRecesses: [{ section: pocket.section, depthMm: dimensions[1] + 0.2 }],
    magnetPocket: {
      preset,
      placement: input.magnetPocketPlacement ?? 'center',
      diameterMm: dimensions[0] + 0.4,
      depthMm: dimensions[1] + 0.2,
      centerMm: pocket.centerMm,
      adjusted: pocket.adjusted,
      safe: pocket.safe,
    },
  };
};
export const buildStyle = (wasm: GeometryWasm, styleId: StyleId, input: StyleInput): StyleBuild => {
  const textInset = effectiveMargin(input);
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  if (input.templateId === 'magnet' && styleId === 'plain') {
    const plate = roundedRect(
      wasm,
      Math.max(34000, textWidth + textInset * 2),
      Math.max(18000, textHeight + textInset * 2),
      Math.max(1500, Math.min(5000, input.cornerRadius ?? textHeight / 2)),
    );
    const relief = input.text;
    const result = finishMagnetStyle(wasm, plate, relief, input, 'left');
    return { ...result, subtitle: input.subtitle };
  }
  if (styleId === 'ribbon') {
    const tail = Math.max(6, input.ribbonTailMm ?? 12) * 1000;
    const notch = Math.min(tail * 0.8, Math.max(1, input.ribbonNotchMm ?? 4) * 1000);
    const plate = roundedRect(
      wasm,
      Math.max(34000, textWidth + textInset * 2 + tail * 2),
      Math.max(18000, textHeight + textInset * 2),
      Math.max(1500, Math.min(5000, input.cornerRadius ?? textHeight / 2)),
    );
    const bounds = sectionBounds(plate);
    const y = (bounds.min[1] + bounds.max[1]) / 2;
    const left = wasm.CrossSection.ofPolygons(
      [
        [
          [bounds.min[0], bounds.min[1]],
          [bounds.min[0] - tail, y - textHeight * 0.28],
          [bounds.min[0] - tail + notch, y],
          [bounds.min[0] - tail, y + textHeight * 0.28],
          [bounds.min[0], bounds.max[1]],
        ],
      ],
      'EvenOdd',
    );
    const right = wasm.CrossSection.ofPolygons(
      [
        [
          [bounds.max[0], bounds.min[1]],
          [bounds.max[0] + tail, y - textHeight * 0.28],
          [bounds.max[0] + tail - notch, y],
          [bounds.max[0] + tail, y + textHeight * 0.28],
          [bounds.max[0], bounds.max[1]],
        ],
      ],
      'EvenOdd',
    );
    const backing = union(wasm, [plate, left, right]);
    plate.delete();
    left.delete();
    right.delete();
    const relief = input.text;
    if (input.templateId === 'magnet') {
      const result = finishMagnetStyle(wasm, backing, relief, input, 'left');
      return { ...result, subtitle: input.subtitle };
    }
    const finished = finishStyle(wasm, backing, relief, input, 'left');
    return finished;
  }
  if (styleId === 'capsule')
    return input.templateId === 'magnet'
      ? finishMagnetStyle(
          wasm,
          plateStyle(wasm, input, Math.max(5000, textHeight / 2)),
          input.text,
          input,
          'right',
        )
      : finishStyle(
          wasm,
          plateStyle(wasm, input, Math.max(5000, textHeight / 2)),
          input.text,
          input,
          'right',
        );
  if (styleId === 'soft-tag') {
    const plate = plateStyle(wasm, input, 3500);
    const bounds = sectionBounds(plate);
    const accent = wasm.CrossSection.circle(
      3400 + Math.max(0, input.tagTailMm ?? 0) * 1000,
      64,
    ).translate([bounds.max[0] - 3000, bounds.max[1] - 3000]);
    const result = union(wasm, [plate, accent]);
    plate.delete();
    accent.delete();
    return input.templateId === 'magnet'
      ? finishMagnetStyle(wasm, result, input.text, input, 'left')
      : finishStyle(wasm, result, input.text, input, 'left');
  }
  if (styleId === 'bubble') {
    const backing = input.text.offset(textInset, 'Round', 2, 64);
    const bounds = sectionBounds(backing);
    const bubbles = [
      wasm.CrossSection.circle(
        Math.max(3000, input.padding + 500 + Math.max(0, input.bubbleLobeMm ?? 0) * 1000),
        64,
      ).translate([bounds.min[0] + 1000, bounds.min[1] + 1000]),
      wasm.CrossSection.circle(
        Math.max(3000, input.padding + 500 + Math.max(0, input.bubbleLobeMm ?? 0) * 1000),
        64,
      ).translate([bounds.max[0] - 1000, bounds.max[1] - 1000]),
    ];
    const joined = union(wasm, [backing, ...bubbles]);
    const decorated = joined.simplify(20);
    joined.delete();
    backing.delete();
    bubbles.forEach((bubble: CrossSection) => bubble.delete());
    return input.templateId === 'magnet'
      ? finishMagnetStyle(wasm, decorated, input.text, input, 'left')
      : finishStyle(wasm, decorated, input.text, input, 'left');
  }
  if (styleId === 'arch') {
    const relief = archWarp(input.text, input.textBounds, input.archCurveMm);
    const backing = relief.offset(textInset, 'Round', 2, 64);
    return input.templateId === 'magnet'
      ? finishMagnetStyle(wasm, backing, relief, input, 'left')
      : finishStyle(wasm, backing, relief, input, 'left');
  }
  const offset = input.text.offset(textInset, 'Round', 2, 64);
  return input.templateId === 'magnet'
    ? finishMagnetStyle(wasm, offset, input.text, input, 'left')
    : finishStyle(wasm, offset, input.text, input, 'left');
};
export const STYLE_CATALOG: Array<{
  id: StyleId;
  name: string;
  description: string;
}> = [
  { id: 'plain', name: 'Plain', description: 'A clean plaque without decorative tails.' },
  { id: 'contour', name: 'Contour', description: 'A soft outline that follows the name.' },
  { id: 'capsule', name: 'Capsule', description: 'A clean pill-shaped nameplate.' },
  { id: 'soft-tag', name: 'Soft tag', description: 'A rounded tag with a playful end.' },
  { id: 'bubble', name: 'Bubble', description: 'An organic, connected silhouette.' },
  { id: 'arch', name: 'Arch', description: 'A gently curved nameplate.' },
  { id: 'ribbon', name: 'Ribbon', description: 'Symmetric tails with restrained folded accents.' },
];
