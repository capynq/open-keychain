import type { CrossSection, GeometryWasm } from '../../../infrastructure/geometry/manifold-types';
import type { KeyringPosition } from '../model/keyring-position';
import type { KeyringOpeningShape } from '../model/keyring-presets';
import type {
  EdgeFinish,
  GeometryConstraints,
  GeometryParameterLimits,
  PrintProfile,
  StyleId,
  TemplateId,
} from '../model/types';
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
  keyringOpeningShape?: KeyringOpeningShape;
  keyringPosition?: KeyringPosition;
  keyringSlotLength?: number;
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
  textEdgeFinish?: EdgeFinish;
  textEdgeMm?: number;
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
  heartSizeMm?: number;
  heartBorderMm?: number;
  heartLeftGapMm?: number;
  heartRightGapMm?: number;
  heartVerticalOffsetMm?: number;
  heartInteriorMode?: 'relief' | 'through-cut';
  heartLeftPresent?: boolean;
  magnetPocketPreset?: '6x2' | '8x2' | '10x3' | '12x3' | '15x3';
  magnetPocketPlacement?: 'center' | 'upper' | 'lower' | 'left' | 'right';
};
export type StyleBuild = {
  parameterLimits?: GeometryParameterLimits;
  backing: CrossSection;
  relief: CrossSection;
  subtitle?: CrossSection;
  recesses?: Array<{
    section: CrossSection;
    depthMm: number;
  }>;
  rearRecesses?: Array<{ section: CrossSection; depthMm: number }>;
  /** Sections that must be removed through the full base thickness. */
  throughCuts?: CrossSection[];
  /** The keyring opening when one was attached; it must stay clear of every material layer. */
  keyringOpening?: KeyringOpening;
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
/** Scan band across the attachment side: a central band for edges, a wide one so corners qualify. */
type AnchorBand = { start: number; end: number; samples: number };
const EDGE_ANCHOR_BAND: AnchorBand = { start: 0.24, end: 0.76, samples: 17 };
const CORNER_ANCHOR_BAND: AnchorBand = { start: 0.1, end: 0.9, samples: 25 };
/**
 * @param lowerSign Sign of the local y axis that points down in the finished model. Equally good
 * extremes (both tips of a ribbon tail) resolve toward it, so mirrored positions stay mirrored.
 */
const attachmentAnchor = (
  section: CrossSection,
  minimumSpan: number,
  side: 'left' | 'right',
  band: AnchorBand = EDGE_ANCHOR_BAND,
  lowerSign = -1,
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
  const step = (band.end - band.start) / (band.samples - 1);
  for (let index = 0; index < band.samples; index += 1) {
    const y = bounds.min[1] + height * (band.start + index * step);
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
      const isTie = best !== undefined && Math.abs(x - best.point[0]) < 0.01;
      const isMirrorTie = isTie && Math.abs(edge - best!.edge) < 1;
      if (
        !best ||
        isFartherOut ||
        (isTie && !isMirrorTie && (width > best.width || edge > best.edge)) ||
        (isMirrorTie && (y - best.point[1]) * lowerSign > 1)
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
/** Clear keyring opening in the backing's coordinates, kept so the builder can prove it stays open. */
export type KeyringOpening = {
  section: CrossSection;
  center: Vec2;
};
const KEYRING_ROTATION: Record<KeyringPosition, number> = {
  left: 0,
  right: 180,
  top: 90,
  bottom: 270,
  'top-left': 45,
  'top-right': 135,
};
const rotatePoint = ([x, y]: Vec2, degrees: number): Vec2 => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos - y * sin, x * sin + y * cos];
};
/**
 * Attach a keyring tab with a deliberately overlapping root and return the opening it cuts.
 * The caller owns both returned sections.
 */
export const ringAssemblyWithOpening = (
  wasm: GeometryWasm,
  base: CrossSection,
  holeDiameter: number,
  wall: number,
  position: KeyringPosition = 'left',
  offsetMm = 0,
  openingShape: KeyringOpeningShape = 'round',
  slotLength = holeDiameter,
): { section: CrossSection; opening: KeyringOpening } => {
  const rotation = KEYRING_ROTATION[position];
  const localBase = rotation === 0 ? base.translate([0, 0]) : base.rotate(rotation);
  let local: ReturnType<typeof ringAssemblyAtLeft>;
  try {
    local = ringAssemblyAtLeft(
      wasm,
      localBase,
      holeDiameter,
      wall,
      offsetMm,
      openingShape,
      slotLength,
      rotation % 90 === 0 ? EDGE_ANCHOR_BAND : CORNER_ANCHOR_BAND,
      /* Model down (0, -1) turned into the local frame; ties have no side for top and bottom. */
      Math.sign(Math.round(-Math.cos((rotation * Math.PI) / 180) * 1000)) || -1,
    );
  } finally {
    localBase.delete();
  }
  if (rotation === 0) return { section: local.section, opening: local.opening };
  try {
    return {
      section: local.section.rotate(-rotation),
      opening: {
        section: local.opening.section.rotate(-rotation),
        center: rotatePoint(local.opening.center, -rotation),
      },
    };
  } finally {
    local.section.delete();
    local.opening.section.delete();
  }
};
/** Material that may graze the opening while it is pushed clear, in scaled square units. */
const OPENING_PUSH_TOLERANCE = 10_000;
const overlapArea = (left: CrossSection, right: CrossSection): number => {
  const overlap = left.intersect(right);
  try {
    return sectionArea(overlap);
  } finally {
    overlap.delete();
  }
};
const ringAssemblyAtLeft = (
  wasm: GeometryWasm,
  base: CrossSection,
  holeDiameter: number,
  wall: number,
  offsetMm: number,
  openingShape: KeyringOpeningShape,
  slotLength: number,
  band: AnchorBand,
  lowerSign: number,
): { section: CrossSection; opening: KeyringOpening } => {
  const bounds = sectionBounds(base);
  const outerRadius = holeDiameter / 2 + wall;
  const overlap = Math.max(5000, wall * 2);
  const rootWidth = Math.max(6000, wall * 2.5);
  const anchor = attachmentAnchor(base, Math.max(wall, 3200), 'left', band, lowerSign);
  const nominalX = anchor[0] - outerRadius + Math.min(1600, outerRadius * 0.34);
  const centerY = anchor[1] + offsetMm * 1000;
  const holeAt = (center: Vec2): CrossSection =>
    openingShape === 'slot'
      ? capsule(
          wasm,
          [center[0], center[1] - Math.max(0, slotLength - holeDiameter) / 2],
          [center[0], center[1] + Math.max(0, slotLength - holeDiameter) / 2],
          holeDiameter,
        )
      : wasm.CrossSection.circle(holeDiameter / 2, 96).translate(center);
  /*
   * Sloped edges, slots, offsets and corners can tuck the nominal opening into the body, where the
   * union would fill it. Move the ring straight out until the opening is clear; the hull below keeps
   * the longer tab joined to its root. Coarse 0.5 mm steps, then bisection to about 0.06 mm.
   */
  const isClear = (shift: number): boolean => {
    const candidate = holeAt([nominalX - shift, centerY]);
    try {
      return overlapArea(candidate, base) <= OPENING_PUSH_TOLERANCE;
    } finally {
      candidate.delete();
    }
  };
  const maximumShift = outerRadius * 2 + Math.max(0, slotLength - holeDiameter);
  let shift = 0;
  if (!isClear(0)) {
    let blocked = 0;
    let clear: number | undefined;
    for (let candidate = 500; candidate <= maximumShift + 1; candidate += 500) {
      if (isClear(candidate)) {
        clear = candidate;
        break;
      }
      blocked = candidate;
    }
    if (clear !== undefined) {
      let clearShift: number = clear;
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const middle: number = (blocked + clearShift) / 2;
        if (isClear(middle)) clearShift = middle;
        else blocked = middle;
      }
      shift = clearShift;
    }
  }
  const center: Vec2 = [nominalX - shift, centerY];
  const hole = holeAt(center);
  const outer =
    openingShape === 'slot'
      ? hole.offset(wall, 'Round', 2, 96)
      : wasm.CrossSection.circle(outerRadius, 96).translate(center);
  const rootHeight = Math.min(
    bounds.max[1] - bounds.min[1],
    Math.max(wall * 2.7, outerRadius * 1.45),
  );
  const root = roundedRect(wasm, rootWidth + overlap, rootHeight, rootHeight / 2).translate([
    anchor[0] - (rootWidth - overlap) / 2,
    anchor[1],
  ]);
  const tabOuter = wasm.CrossSection.hull([outer, root]);
  const tab = tabOuter.subtract(hole);
  const result = union(wasm, [base, tab]);
  outer.delete();
  root.delete();
  tabOuter.delete();
  tab.delete();
  return { section: result, opening: { section: hole, center } };
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

const sectionIsConnected = (section: CrossSection): boolean => {
  const components = section.decompose();
  try {
    return components.length === 1;
  } finally {
    components.forEach((component) => component.delete());
  }
};

/** Close only small outline gaps that would otherwise become accidental loose prints. */
const closeSmallSectionGaps = (section: CrossSection, maximumRadius = 2200): CrossSection => {
  if (sectionIsConnected(section)) return section;
  for (const radius of [600, 1000, 1500, 2200, 3000, 4500]) {
    if (radius > maximumRadius) break;
    const expanded = section.offset(radius, 'Round', 2, 32);
    const closed = expanded.offset(-radius, 'Round', 2, 32);
    expanded.delete();
    if (!sectionIsConnected(closed)) {
      closed.delete();
      continue;
    }
    section.delete();
    return closed;
  }
  return section;
};

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
  preserveSeparateParts = false,
): StyleBuild => {
  const textInset = effectiveMargin(input);
  const reliefHalo = Math.max(0, input.reliefHaloMm ?? 0) * 1000;
  const supportOffset = Math.max(600, Math.min(textInset + reliefHalo, 1200 + reliefHalo));
  const support = relief.offset(supportOffset, 'Round', 2, 64);
  const subtitleSupport = input.subtitle
    ? input.subtitle.offset(supportOffset, 'Round', 2, 64)
    : undefined;
  const joinedRaw = union(
    wasm,
    subtitleSupport ? [backing, support, subtitleSupport] : [backing, support],
  );
  /* Heart Split: two pieces; keep print-mode policy */
  const joined = preserveSeparateParts
    ? joinedRaw
    : closeSmallSectionGaps(
        joinedRaw,
        input.letterSpacing && input.letterSpacing > 2.4 ? 2200 : 4500,
      );
  const combined = joined.simplify(20);
  backing.delete();
  support.delete();
  subtitleSupport?.delete();
  joined.delete();
  if (!attachKeyring) return { backing: combined, relief, subtitle: input.subtitle, recesses };
  const ring = ringAssemblyWithOpening(
    wasm,
    combined,
    input.holeDiameter,
    input.keyringWall,
    input.keyringPosition ?? side,
    input.ringOffsetMm ?? 0,
    input.keyringOpeningShape ?? 'round',
    input.keyringSlotLength ?? input.holeDiameter,
  );
  combined.delete();
  return {
    backing: ring.section,
    relief,
    subtitle: input.subtitle,
    recesses,
    keyringOpening: ring.opening,
  };
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

const heartPolygon = (size: number, center: Vec2): Vec2[] => {
  /* 128 samples: smooth lobes, bounded export size */
  const points: Vec2[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < 128; index += 1) {
    const angle = (index / 128) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const x = 16 * sin ** 3;
    const y = 13 * cos - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
    points.push([x, y]);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const scaleX = (size * 0.9) / (maxX - minX);
  const scaleY = size / (maxY - minY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return points.map(([x, y]) => [(x - midX) * scaleX + center[0], (y - midY) * scaleY + center[1]]);
};

/** Build a horizontal text / heart / text composition. */
const heartSplitStyle = (wasm: GeometryWasm, input: StyleInput): StyleBuild => {
  const textBounds = sectionBounds(input.text);
  const leftWidth = textBounds.max[0] - textBounds.min[0];
  const rightBounds = input.subtitle ? sectionBounds(input.subtitle) : textBounds;
  const rightWidth = rightBounds.max[0] - rightBounds.min[0];
  const size = Math.max(12000, Math.min(32000, (input.heartSizeMm ?? 22) * 1000));
  const border = Math.max(1200, Math.min(size * 0.22, (input.heartBorderMm ?? 1.6) * 1000));
  const leftGap = (input.heartLeftGapMm ?? -1.5) * 1000;
  const rightGap = (input.heartRightGapMm ?? -1.5) * 1000;
  const centerY = (input.heartVerticalOffsetMm ?? 1.5) * 1000;
  const heartCenterX = 0;
  const leftCenterX = -size / 2 - leftGap - leftWidth / 2;
  const rightCenterX = size / 2 + rightGap + rightWidth / 2;
  const left = input.text.translate([
    leftCenterX - (textBounds.min[0] + textBounds.max[0]) / 2,
    -centerY,
  ]);
  const right = input.subtitle?.translate([
    rightCenterX - (rightBounds.min[0] + rightBounds.max[0]) / 2,
    -centerY,
  ]);
  const outer = wasm.CrossSection.ofPolygons(
    [heartPolygon(size, [heartCenterX, centerY])],
    'EvenOdd',
  );
  const inner = wasm.CrossSection.ofPolygons(
    [heartPolygon(Math.max(3000, size - border * 2), [heartCenterX, centerY])],
    'EvenOdd',
  );
  const throughCut =
    input.heartInteriorMode === 'through-cut'
      ? wasm.CrossSection.ofPolygons(
          [heartPolygon(Math.max(3000, size - border * 2), [heartCenterX, centerY])],
          'EvenOdd',
        )
      : undefined;
  const heartRing = outer.subtract(inner);
  const heartFoundation = outer.translate([0, 0]);
  outer.delete();
  inner.delete();
  let leftSupport =
    input.heartLeftPresent === false
      ? undefined
      : left.offset(effectiveMargin(input), 'Round', 2, 64);
  if (leftSupport) leftSupport = closeSmallSectionGaps(leftSupport);
  let rightSupport = right?.offset(effectiveMargin(input), 'Round', 2, 64);
  if (rightSupport) rightSupport = closeSmallSectionGaps(rightSupport);
  const backingParts: CrossSection[] = [heartFoundation];
  if (leftSupport) backingParts.unshift(leftSupport);
  if (rightSupport) backingParts.push(rightSupport);
  /* Narrow bridge keeps positive gaps printable */
  const heartBounds = sectionBounds(heartRing);
  if (left && leftSupport)
    backingParts.push(
      capsule(
        wasm,
        [heartBounds.min[0], centerY],
        [leftSupport.bounds().max[0], centerY],
        Math.max(1200, border * 0.45),
      ),
    );
  if (right && rightSupport)
    backingParts.push(
      capsule(
        wasm,
        [heartBounds.max[0], centerY],
        [rightSupport.bounds().min[0], centerY],
        Math.max(1200, border * 0.45),
      ),
    );
  const backing = union(wasm, backingParts).simplify(20);
  const reliefHeart = heartRing.translate([0, 0]);
  /* Negative gaps: cut support envelope from through-cut */
  let safeThroughCut = throughCut;
  if (throughCut) {
    const envelopes = leftSupport ? [leftSupport] : [];
    if (right) envelopes.push(right.offset(effectiveMargin(input), 'Round', 2, 64));
    const protectedCut = union(wasm, envelopes);
    safeThroughCut = throughCut.subtract(protectedCut);
    throughCut.delete();
    protectedCut.delete();
    envelopes.forEach((envelope) => envelope.delete());
  }
  const reliefParts = [
    ...(input.heartLeftPresent === false ? [] : [left]),
    ...(input.heartInteriorMode === 'relief' ? [reliefHeart] : []),
  ];
  if (right) reliefParts.push(right);
  const relief = union(wasm, reliefParts).simplify(20);
  left.delete();
  /* Word already included; no second subtitle support */
  const heartInput = { ...input, subtitle: undefined };
  const finished =
    input.templateId === 'magnet'
      ? finishMagnetStyle(wasm, backing, relief, heartInput, 'right')
      : finishStyle(wasm, backing, relief, heartInput, 'right', undefined, true, true);
  return {
    ...finished,
    subtitle: undefined,
    throughCuts: safeThroughCut ? [safeThroughCut] : undefined,
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
  if (styleId === 'heart-split') return heartSplitStyle(wasm, input);
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
    const height = bounds.max[1] - bounds.min[1];
    const radius = Math.max(
      3000,
      input.padding + 500 + Math.max(0, input.bubbleLobeMm ?? 0) * 1000,
    );
    const lobePositions: Array<[[number, number], [number, number]]> = [
      [
        [bounds.min[0] + 1000, bounds.min[1] + 1000],
        [bounds.min[0] + height * 0.34, bounds.max[1] - height * 0.3],
      ],
      [
        [bounds.max[0] - 1000, bounds.max[1] - 1000],
        [bounds.max[0] - height * 0.22, bounds.min[1] + height * 0.25],
      ],
    ];
    const isConnected = (section: CrossSection): boolean => {
      const components = section.decompose();
      try {
        return components.length === 1;
      } finally {
        components.forEach((component) => component.delete());
      }
    };
    /* Lobes must touch carrier; else loose prints */
    let decorated = backing;
    for (const positions of lobePositions) {
      for (const position of positions) {
        const bubble = wasm.CrossSection.circle(radius, 64).translate(position);
        const candidate = union(wasm, [decorated, bubble]);
        bubble.delete();
        if (!isConnected(candidate)) {
          candidate.delete();
          continue;
        }
        if (decorated !== backing) decorated.delete();
        decorated = candidate;
        break;
      }
    }
    const simplified = decorated.simplify(20);
    if (decorated !== backing) decorated.delete();
    backing.delete();
    return input.templateId === 'magnet'
      ? finishMagnetStyle(wasm, simplified, input.text, input, 'left')
      : finishStyle(wasm, simplified, input.text, input, 'left');
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
  {
    id: 'heart-split',
    name: 'Heart',
    description: 'A paired heart silhouette with a clean center split.',
  },
];
