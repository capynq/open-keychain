import type { StyleId } from './types';

export type Vec2 = [number, number];
export type Bounds2 = { min: Vec2; max: Vec2 };

type CrossSection = any;

export type StyleInput = {
  text: CrossSection;
  textBounds: Bounds2;
  padding: number;
  holeDiameter: number;
  keyringWall: number;
};

export type StyleBuild = {
  backing: CrossSection;
  recesses?: Array<{ section: CrossSection; depthMm: number }>;
};

function roundedRect(wasm: any, width: number, height: number, radius: number): CrossSection {
  const innerWidth = Math.max(100, width - radius * 2);
  const innerHeight = Math.max(100, height - radius * 2);
  return wasm.CrossSection.square([innerWidth, innerHeight], true).offset(radius, 'Round', 2, 64);
}

function union(wasm: any, sections: CrossSection[]): CrossSection {
  return wasm.CrossSection.union(sections);
}

function sectionBounds(section: CrossSection): Bounds2 {
  const bounds = section.bounds();
  return { min: [bounds.min[0], bounds.min[1]], max: [bounds.max[0], bounds.max[1]] };
}

function polygonArea(polygon: Vec2[]): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function outerBoundary(section: CrossSection): Vec2[] {
  const polygons = section.toPolygons() as Vec2[][];
  return polygons.reduce(
    (largest, polygon) => (Math.abs(polygonArea(polygon)) > Math.abs(polygonArea(largest)) ? polygon : largest),
    polygons[0] ?? [],
  );
}

function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return start;
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return [start[0] + dx * t, start[1] + dy * t];
}

type BoundaryPair = { start: Vec2; end: Vec2; distanceSquared: number };

function nearestBoundaryPair(left: Vec2[], right: Vec2[]): BoundaryPair {
  let best: BoundaryPair = { start: left[0], end: right[0], distanceSquared: Infinity };
  const consider = (start: Vec2, end: Vec2) => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < best.distanceSquared) best = { start, end, distanceSquared };
  };
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex];
    const leftEnd = left[(leftIndex + 1) % left.length];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex];
      const rightEnd = right[(rightIndex + 1) % right.length];
      consider(leftStart, closestPointOnSegment(leftStart, rightStart, rightEnd));
      consider(leftEnd, closestPointOnSegment(leftEnd, rightStart, rightEnd));
      consider(closestPointOnSegment(rightStart, leftStart, leftEnd), rightStart);
      consider(closestPointOnSegment(rightEnd, leftStart, leftEnd), rightEnd);
    }
  }
  return best;
}

function capsule(wasm: any, start: Vec2, end: Vec2, width: number): CrossSection {
  const radius = width / 2;
  const startCap = wasm.CrossSection.circle(radius, 64).translate(start);
  const endCap = wasm.CrossSection.circle(radius, 64).translate(end);
  const result = wasm.CrossSection.hull([startCap, endCap]);
  startCap.delete();
  endCap.delete();
  return result;
}

/** Connect disconnected outer components with a minimum spanning tree of rounded boundary capsules. */
function connectIfNeeded(wasm: any, section: CrossSection, padding: number): CrossSection {
  const pieces = section.decompose();
  if (pieces.length <= 1) {
    pieces.forEach((piece: CrossSection) => piece.delete());
    return section;
  }
  const boundaries = pieces.map(outerBoundary);
  const visited = new Set<number>([0]);
  const bridgeWidth = Math.max(2000, padding);
  const bridges: CrossSection[] = [];
  while (visited.size < pieces.length) {
    let best: (BoundaryPair & { from: number; to: number }) | undefined;
    for (const from of visited)
      for (let to = 0; to < pieces.length; to += 1) {
        if (visited.has(to)) continue;
        const candidate = nearestBoundaryPair(boundaries[from], boundaries[to]);
        if (!best || candidate.distanceSquared < best.distanceSquared) best = { ...candidate, from, to };
      }
    if (!best) break;
    bridges.push(capsule(wasm, best.start, best.end, bridgeWidth));
    visited.add(best.to);
  }
  pieces.forEach((piece: CrossSection) => piece.delete());
  const bounds = sectionBounds(section);
  const joined = union(wasm, [section, ...bridges]);
  const connected = joined.simplify(20);
  joined.delete();
  section.delete();
  bridges.forEach((bridge) => bridge.delete());
  const connectedPieces = connected.decompose();
  const stillDisconnected = connectedPieces.length > 1;
  connectedPieces.forEach((piece: CrossSection) => piece.delete());
  if (!stillDisconnected) return connected;

  const safePlate = roundedRect(
    wasm,
    bounds.max[0] - bounds.min[0] + padding * 2,
    bounds.max[1] - bounds.min[1] + padding * 2,
    Math.max(1200, padding),
  ).translate([(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2]);
  const safeJoined = union(wasm, [connected, safePlate]);
  const safe = safeJoined.simplify(20);
  safeJoined.delete();
  connected.delete();
  safePlate.delete();
  return safe;
}

function horizontalIntervals(polygons: Vec2[][], y: number): Array<[number, number]> {
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
}

function attachmentAnchor(section: CrossSection, minimumSpan: number, side: 'left' | 'right'): Vec2 {
  const bounds = sectionBounds(section);
  const polygons = section.toPolygons() as Vec2[][];
  const height = bounds.max[1] - bounds.min[1];
  let best: { point: Vec2; width: number; edge: number } | undefined;
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
        side === 'left' ? x < (best?.point[0] ?? Infinity) - 0.01 : x > (best?.point[0] ?? -Infinity) + 0.01;
      if (!best || isFartherOut || (Math.abs(x - best.point[0]) < 0.01 && (width > best.width || edge > best.edge))) {
        best = { point: [x, y], width, edge };
      }
    }
  }
  return best?.point ?? [side === 'left' ? bounds.min[0] : bounds.max[0], (bounds.min[1] + bounds.max[1]) / 2];
}

/** Attach a keyring tab while preserving the counter opening and repairing detached unions. */
function ringAssembly(
  wasm: any,
  base: CrossSection,
  holeDiameter: number,
  wall: number,
  side: 'left' | 'right' = 'left',
): CrossSection {
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
  const rootHeight = Math.min(bounds.max[1] - bounds.min[1], Math.max(wall * 2.7, outerRadius * 1.45));
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

  const parts = result.decompose();
  const connected = parts.length === 1;
  parts.forEach((part: CrossSection) => part.delete());
  if (connected) return result;

  return connectIfNeeded(wasm, result, wall);
}

function plateStyle(wasm: any, input: StyleInput, radius: number, side: 'left' | 'right'): CrossSection {
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  const width = Math.max(34000, textWidth + input.padding * 2 + 6000);
  const height = Math.max(18000, textHeight + input.padding * 2);
  const plate = roundedRect(wasm, width, height, radius);
  const result = ringAssembly(wasm, plate, input.holeDiameter, input.keyringWall, side);
  plate.delete();
  return result;
}

export function buildStyle(wasm: any, styleId: StyleId, input: StyleInput): StyleBuild {
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];

  if (styleId === 'capsule') return { backing: plateStyle(wasm, input, Math.max(5000, textHeight / 2), 'right') };
  if (styleId === 'soft-tag') {
    const plate = plateStyle(wasm, input, 3500, 'left');
    const bounds = sectionBounds(plate);
    const accent = wasm.CrossSection.circle(3400, 64).translate([bounds.max[0] - 3000, bounds.max[1] - 3000]);
    const result = union(wasm, [plate, accent]);
    plate.delete();
    accent.delete();
    return { backing: result };
  }
  if (styleId === 'bubble') {
    const backing = input.text.offset(input.padding + 800, 'Round', 2, 64);
    const connectedBacking = connectIfNeeded(wasm, backing, input.padding);
    const bounds = sectionBounds(connectedBacking);
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
    const joined = union(wasm, [connectedBacking, ...bubbles]);
    const decorated = joined.simplify(20);
    joined.delete();
    connectedBacking.delete();
    bubbles.forEach((bubble: CrossSection) => bubble.delete());
    const organic = connectIfNeeded(wasm, decorated, input.padding);
    const result = ringAssembly(wasm, organic, input.holeDiameter, input.keyringWall, 'left');
    organic.delete();
    return { backing: result };
  }
  if (styleId === 'arch') {
    const centerX = (input.textBounds.min[0] + input.textBounds.max[0]) / 2;
    const width = Math.max(textWidth, 1);
    const arch = input.text.warp((point: Vec2) => {
      const normalized = (point[0] - centerX) / (width / 2);
      point[1] += Math.max(1500, Math.min(5000, textHeight * 0.18)) * (1 - normalized * normalized);
    });
    const backing = connectIfNeeded(wasm, arch.offset(Math.max(input.padding, 2400), 'Round', 2, 64), input.padding);
    arch.delete();
    const result = ringAssembly(wasm, backing, input.holeDiameter, input.keyringWall, 'left');
    backing.delete();
    return { backing: result };
  }
  if (styleId === 'frame') {
    const width = Math.max(38000, textWidth + input.padding * 2 + 10000);
    const height = Math.max(20000, textHeight + input.padding * 2 + 2000);
    const outer = roundedRect(wasm, width, height, 4000);
    const innerCut = roundedRect(wasm, width - 8000, height - 8000, 1500);
    const frame = outer.subtract(innerCut);
    const textPad = connectIfNeeded(
      wasm,
      input.text.offset(Math.max(input.padding, 2600), 'Round', 2, 64),
      input.padding,
    );
    const rawCombined = union(wasm, [frame, textPad]);
    const combined = connectIfNeeded(wasm, rawCombined, 6000);
    const recessPad = input.text.offset(500, 'Round', 2, 64);
    const result = ringAssembly(wasm, combined, input.holeDiameter, input.keyringWall, 'right');
    outer.delete();
    innerCut.delete();
    frame.delete();
    return { backing: result, recesses: [{ section: recessPad, depthMm: 0.2 }] };
  }

  const offset = connectIfNeeded(wasm, input.text.offset(Math.max(input.padding, 2400), 'Round', 2, 64), input.padding);
  const result = ringAssembly(wasm, offset, input.holeDiameter, input.keyringWall, 'left');
  offset.delete();
  return { backing: result };
}

export const STYLE_CATALOG: Array<{ id: StyleId; name: string; description: string }> = [
  { id: 'contour', name: 'Contour', description: 'A soft outline that follows the name.' },
  { id: 'capsule', name: 'Capsule', description: 'A clean pill-shaped nameplate.' },
  { id: 'soft-tag', name: 'Soft tag', description: 'A rounded tag with a playful end.' },
  { id: 'bubble', name: 'Bubble', description: 'An organic, connected silhouette.' },
  { id: 'arch', name: 'Arch', description: 'A gently curved nameplate.' },
  { id: 'frame', name: 'Frame', description: 'A bold plate with an inset border.' },
];
