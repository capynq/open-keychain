import type { GeometryConstraints, PrintProfile, StyleId, TemplateId } from '../model/types';
import type { GlyphOutline } from '../text/outline';
import type { CrossSection, GeometryWasm } from '../../../infrastructure/geometry/manifold-types';
export type Vec2 = [number, number];
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
};
export type StyleBuild = {
  backing: CrossSection;
  relief: CrossSection;
  recesses?: Array<{
    section: CrossSection;
    depthMm: number;
  }>;
  /** Optional template-specific cap depth in millimetres. */
  reliefDepthMm?: number;
  constraints?: GeometryConstraints;
  printProfile?: PrintProfile;
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
  const center: Vec2 = [x, anchor[1]];
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
  const textInset = Math.max(600, input.textInset ?? input.padding);
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  const width = Math.max(34000, textWidth + textInset * 2 + 6000);
  const height = Math.max(18000, textHeight + textInset * 2);
  return roundedRect(wasm, width, height, radius);
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
): StyleBuild => {
  const textInset = Math.max(600, input.textInset ?? input.padding);
  const support = relief.offset(Math.max(600, Math.min(textInset, 1200)), 'Round', 2, 64);
  const joined = union(wasm, [backing, support]);
  const combined = joined.simplify(20);
  backing.delete();
  support.delete();
  joined.delete();
  const result = attachKeyring
    ? ringAssembly(wasm, combined, input.holeDiameter, input.keyringWall, side)
    : combined;
  if (result !== combined) combined.delete();
  return { backing: result, relief, recesses };
};
export const buildStyle = (wasm: GeometryWasm, styleId: StyleId, input: StyleInput): StyleBuild => {
  const textInset = Math.max(600, input.textInset ?? input.padding);
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  if (styleId === 'capsule')
    return finishStyle(
      wasm,
      plateStyle(wasm, input, Math.max(5000, textHeight / 2)),
      input.text,
      input,
      'right',
    );
  if (styleId === 'soft-tag') {
    const plate = plateStyle(wasm, input, 3500);
    const bounds = sectionBounds(plate);
    const accent = wasm.CrossSection.circle(3400, 64).translate([
      bounds.max[0] - 3000,
      bounds.max[1] - 3000,
    ]);
    const result = union(wasm, [plate, accent]);
    plate.delete();
    accent.delete();
    return finishStyle(wasm, result, input.text, input, 'left');
  }
  if (styleId === 'bubble') {
    const backing = input.text.offset(textInset, 'Round', 2, 64);
    const bounds = sectionBounds(backing);
    const bubbles = [
      wasm.CrossSection.circle(Math.max(3000, input.padding + 500), 64).translate([
        bounds.min[0] + 1000,
        bounds.min[1] + 1000,
      ]),
      wasm.CrossSection.circle(Math.max(3000, input.padding + 500), 64).translate([
        bounds.max[0] - 1000,
        bounds.max[1] - 1000,
      ]),
    ];
    const joined = union(wasm, [backing, ...bubbles]);
    const decorated = joined.simplify(20);
    joined.delete();
    backing.delete();
    bubbles.forEach((bubble: CrossSection) => bubble.delete());
    return finishStyle(wasm, decorated, input.text, input, 'left');
  }
  if (styleId === 'arch') {
    const centerX = (input.textBounds.min[0] + input.textBounds.max[0]) / 2;
    const width = Math.max(textWidth, 1);
    const warp = (point: Vec2) => {
      const normalized = (point[0] - centerX) / (width / 2);
      point[1] += Math.max(1500, Math.min(5000, textHeight * 0.18)) * (1 - normalized * normalized);
    };
    const relief = input.text.warp(warp);
    const backing = relief.offset(textInset, 'Round', 2, 64);
    return finishStyle(wasm, backing, relief, input, 'left');
  }
  const offset = input.text.offset(textInset, 'Round', 2, 64);
  return finishStyle(wasm, offset, input.text, input, 'left');
};
export const STYLE_CATALOG: Array<{
  id: StyleId;
  name: string;
  description: string;
}> = [
  { id: 'contour', name: 'Contour', description: 'A soft outline that follows the name.' },
  { id: 'capsule', name: 'Capsule', description: 'A clean pill-shaped nameplate.' },
  { id: 'soft-tag', name: 'Soft tag', description: 'A rounded tag with a playful end.' },
  { id: 'bubble', name: 'Bubble', description: 'An organic, connected silhouette.' },
  { id: 'arch', name: 'Arch', description: 'A gently curved nameplate.' },
];
