import type { StyleId, TemplateId } from '../model/types';
import {
  DEFAULT_GEOMETRY_CONSTRAINTS,
  DEFAULT_PRINT_PROFILE,
  type GeometryConstraints,
  type PrintProfile,
} from '../model/types';
import {
  buildStyle,
  capsule,
  effectiveMargin,
  ringAssembly,
  roundedRect,
  sectionBounds,
  union,
  type StyleBuild,
  type StyleInput,
} from '../styles/style-builder';
import type {
  CrossSection,
  DisposableGeometry,
  GeometryWasm,
  Manifold,
} from '../../../infrastructure/geometry/manifold-types';
type Solid = Manifold;
type Vec2 = [number, number];
const MANIFOLD_SCALE = 1000;
export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  supportsKeyring: boolean;
  supportsSubtitle: boolean;
  styles: readonly StyleId[];
  hardware?: string;
};
const ALL_STYLE_IDS: readonly StyleId[] = ['contour', 'capsule', 'soft-tag', 'bubble', 'arch'];
const RIBBON_STYLES: readonly StyleId[] = [...ALL_STYLE_IDS, 'ribbon'];
export type ArticulatedPart = {
  body: Solid;
  cap: Solid;
  solid: Solid;
  centerX: number;
  width: number;
  leftAnchor?: Vec2;
  rightAnchor?: Vec2;
  structuralArea: number;
  structuralBounds: {
    min: Vec2;
    max: Vec2;
  };
  glyphBounds: {
    min: Vec2;
    max: Vec2;
  };
};
export type ArticulatedBuild = {
  kind: 'articulated';
  parts: ArticulatedPart[];
  connectors: Solid[];
  widthMm: number;
  bounds: {
    min: number[];
    max: number[];
  };
  invariants: {
    headDiameter: number;
    throatWidth: number;
    chamberDiameter: number;
    neckWidth: number;
    clearance: number;
    minimumWall: number;
    axialWall: number;
    minimumAxialWall: number;
    motionAllowance: number;
    countersPreserved: boolean;
  };
  constraints?: GeometryConstraints;
  printProfile?: PrintProfile;
};
export type TemplateBuild = StyleBuild | ArticulatedBuild;
export const TEMPLATE_CATALOG: readonly TemplateDefinition[] = [
  {
    id: 'name-keychain',
    name: 'Name keychain',
    description: 'A backing contour that follows the name.',
    supportsKeyring: true,
    supportsSubtitle: true,
    styles: RIBBON_STYLES,
  },
  {
    id: 'articulated-name',
    name: 'Articulated name',
    description: 'Separate letter-shaped bodies linked by compact captive print-in-place joints.',
    supportsKeyring: true,
    supportsSubtitle: false,
    styles: [],
  },
  {
    id: 'magnet',
    name: 'Magnet',
    description: 'A personalized magnet with a safe blind rear pocket for a disc magnet.',
    supportsKeyring: false,
    supportsSubtitle: true,
    styles: ['plain', 'contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'ribbon'],
    hardware: 'Glue in the selected disc magnet; the blind rear pocket is not printable hardware.',
  },
  {
    id: 'nameplate',
    name: 'Nameplate',
    description: 'A rounded sign with a tilted, embedded inscription.',
    supportsKeyring: false,
    supportsSubtitle: true,
    styles: [],
  },
  {
    id: 'plant-label',
    name: 'Plant label',
    description: 'A printable label board with an integrated stake.',
    supportsKeyring: false,
    supportsSubtitle: true,
    styles: ALL_STYLE_IDS,
  },
];
type ArticulatedPrototype = {
  glyph: CrossSection;
  structural: CrossSection;
  leftAnchor?: Vec2;
  rightAnchor?: Vec2;
  glyphBounds: {
    min: Vec2;
    max: Vec2;
  };
  structuralBounds: {
    min: Vec2;
    max: Vec2;
  };
  countersPreserved: boolean;
};
const deleteAll = (items: DisposableGeometry[]): void => {
  items.forEach((item) => {
    try {
      item.delete();
    } catch (error) {
      void error;
    }
  });
};
const scalePolygons = (
  polygons: Array<Array<[number, number]>>,
): Array<Array<[number, number]>> => {
  return polygons.map((polygon) =>
    polygon.map(
      ([x, y]) => [Math.round(x * MANIFOLD_SCALE), Math.round(y * MANIFOLD_SCALE)] as Vec2,
    ),
  );
};
const aggregateBounds = (
  solids: Solid[],
): {
  min: number[];
  max: number[];
} => {
  const bounds = solids.map((solid) => solid.boundingBox());
  return {
    min: [
      Math.min(...bounds.map((bound) => bound.min[0])),
      Math.min(...bounds.map((bound) => bound.min[1])),
      Math.min(...bounds.map((bound) => bound.min[2])),
    ],
    max: [
      Math.max(...bounds.map((bound) => bound.max[0])),
      Math.max(...bounds.map((bound) => bound.max[1])),
      Math.max(...bounds.map((bound) => bound.max[2])),
    ],
  };
};
const area = (section: CrossSection): number => {
  const polygonArea = (polygon: Vec2[]) =>
    polygon.reduce((total, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return total + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2;
  return Math.abs(
    (section.toPolygons() as Vec2[][]).reduce((total, polygon) => total + polygonArea(polygon), 0),
  );
};
const signedArea = (polygon: Vec2[]): number => {
  return (
    polygon.reduce((total, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return total + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
};
const counterPolygons = (section: CrossSection): Vec2[][] => {
  const polygons = section.toPolygons() as Vec2[][];
  if (!polygons.length) return [];
  const outer = polygons.reduce(
    (largest, polygon) =>
      Math.abs(signedArea(polygon)) > Math.abs(signedArea(largest)) ? polygon : largest,
    polygons[0],
  );
  const outerSign = Math.sign(signedArea(outer));
  return polygons.filter(
    (polygon) => Math.abs(signedArea(polygon)) > 1 && Math.sign(signedArea(polygon)) !== outerSign,
  );
};
const preserveCounters = (
  wasm: GeometryWasm,
  structural: CrossSection,
  glyph: CrossSection,
): {
  section: CrossSection;
  preserved: boolean;
} => {
  const polygons = counterPolygons(glyph);
  if (!polygons.length) return { section: structural, preserved: true };
  const counters = wasm.CrossSection.ofPolygons(polygons, 'EvenOdd');
  const section = structural.subtract(counters);
  structural.delete();
  const overlap = section.intersect(counters);
  const preserved = area(overlap) <= 1;
  overlap.delete();
  counters.delete();
  return { section, preserved };
};
const horizontalIntervals = (section: CrossSection, y: number): Array<[number, number]> => {
  const intersections: number[] = [];
  for (const polygon of section.toPolygons() as Vec2[][])
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if ((start[1] <= y && end[1] > y) || (end[1] <= y && start[1] > y))
        intersections.push(start[0] + ((y - start[1]) * (end[0] - start[0])) / (end[1] - start[1]));
    }
  intersections.sort((left, right) => left - right);
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index + 1 < intersections.length; index += 2)
    intervals.push([intersections[index], intersections[index + 1]]);
  return intervals;
};
const closestPointOnSegment = (point: Vec2, start: Vec2, end: Vec2): Vec2 => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return start;
  const ratio = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared),
  );
  return [start[0] + dx * ratio, start[1] + dy * ratio];
};
const nearestBoundaryPoint = (section: CrossSection, target: Vec2): Vec2 => {
  let nearest: Vec2 | undefined;
  let nearestDistance = Infinity;
  for (const polygon of section.toPolygons() as Vec2[][])
    for (let index = 0; index < polygon.length; index += 1) {
      const candidate = closestPointOnSegment(
        target,
        polygon[index],
        polygon[(index + 1) % polygon.length],
      );
      const distance = (candidate[0] - target[0]) ** 2 + (candidate[1] - target[1]) ** 2;
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
  return nearest ?? target;
};
const anchorForSide = (
  section: CrossSection,
  jointY: number,
  side: 'left' | 'right',
  chamberRadius: number,
  wall: number,
): {
  anchor: Vec2;
  root: Vec2;
} => {
  const bounds = sectionBounds(section);
  const intervals = horizontalIntervals(section, jointY);
  const edgeX = intervals.length
    ? side === 'left'
      ? Math.min(...intervals.map(([start]) => start))
      : Math.max(...intervals.map(([, end]) => end))
    : side === 'left'
      ? bounds.min[0]
      : bounds.max[0];
  const direction = side === 'left' ? -1 : 1;
  const anchor: Vec2 = [edgeX - direction * Math.max(0, chamberRadius - wall), jointY];
  const root = nearestBoundaryPoint(section, [edgeX, jointY]);
  return { anchor, root };
};
const addJointBoss = (
  wasm: GeometryWasm,
  structure: CrossSection,
  anchor: Vec2,
  root: Vec2,
  bossRadius: number,
): CrossSection => {
  const boss = wasm.CrossSection.circle(bossRadius, 64).translate(anchor);
  const rootWidth = Math.max(1400, Math.min(bossRadius * 1.35, bossRadius * 2));
  const neck = capsule(wasm, root, anchor, rootWidth);
  const joined = union(wasm, [structure, boss, neck]).simplify(20);
  boss.delete();
  neck.delete();
  structure.delete();
  return joined;
};
const articulatedSocket = (
  wasm: GeometryWasm,
  anchor: Vec2,
  side: 'left' | 'right',
  carrierEdge: number,
  chamberRadius: number,
  bridgeWidth: number,
  clearance: number,
  connectorThickness: number,
  socketZ: number,
): Solid => {
  const chamber = wasm.CrossSection.circle(chamberRadius, 64).translate(anchor);
  const throatWidth = bridgeWidth + clearance * 2;
  const reach = chamberRadius + bridgeWidth;
  const throatEnd: Vec2 = [side === 'left' ? carrierEdge - reach : carrierEdge + reach, anchor[1]];
  const throat = capsule(wasm, anchor, throatEnd, throatWidth);
  const relief = capsule(
    wasm,
    anchor,
    throatEnd,
    Math.max(throatWidth, bridgeWidth + clearance * 3),
  );
  const socket2d = union(wasm, [chamber, throat, relief]);
  const socket = socket2d.extrude(connectorThickness + clearance * 2).translate([0, 0, socketZ]);
  chamber.delete();
  throat.delete();
  relief.delete();
  socket2d.delete();
  return socket;
};
const connectorSolid = (
  wasm: GeometryWasm,
  leftAnchor: Vec2,
  rightAnchor: Vec2,
  headRadius: number,
  bridgeWidth: number,
  connectorThickness: number,
  connectorZ: number,
): Solid => {
  const leftHead = wasm.CrossSection.circle(headRadius, 64).translate(leftAnchor);
  const rightHead = wasm.CrossSection.circle(headRadius, 64).translate(rightAnchor);
  const bridge = capsule(wasm, leftAnchor, rightAnchor, bridgeWidth);
  const dogbone = union(wasm, [leftHead, bridge, rightHead]).simplify(20);
  const solid = dogbone.extrude(connectorThickness).translate([0, 0, connectorZ]);
  leftHead.delete();
  rightHead.delete();
  bridge.delete();
  dogbone.delete();
  return solid;
};
const articulatedStyle = (wasm: GeometryWasm, input: StyleInput): ArticulatedBuild | StyleBuild => {
  const glyphs = input.glyphs ?? [];
  if (!glyphs.length || input.baseThickness === undefined || input.reliefDepth === undefined)
    return buildStyle(wasm, 'contour', input);
  const clearance = Math.max(200, (input.jointClearance ?? 0.35) * MANIFOLD_SCALE);
  const mechanicalGap = Math.max(400, (input.mechanicalGap ?? 0.6) * MANIFOLD_SCALE);
  const minimumWall = Math.max(1000, (input.minimumWall ?? 1.2) * MANIFOLD_SCALE);
  const baseThickness = Math.max(3400, input.baseThickness * MANIFOLD_SCALE);
  const reliefDepth = input.reliefDepth * MANIFOLD_SCALE;
  const bottomClearance = Math.max(200, (input.bottomClearance ?? 0.25) * MANIFOLD_SCALE);
  const glyphExpansion = Math.max(0, (input.articulatedOutlineExpansionMm ?? 0) * MANIFOLD_SCALE);
  const bridgeWidth = Math.max(1400, (input.connectorWidth ?? 1.8) * MANIFOLD_SCALE);
  const headRadius = Math.max(1500, bridgeWidth / 2 + 650);
  const neckWidth = Math.max(1200, bridgeWidth * 0.8);
  const maxAngle = Math.min(50, Math.max(15, input.maxJointAngleDeg ?? 35));
  const motionAllowance = Math.sin((maxAngle * Math.PI) / 180) * neckWidth * 0.25;
  const chamberRadius = headRadius + clearance + motionAllowance;
  const bossRadius =
    chamberRadius + minimumWall + Math.max(0, input.jointBossMm ?? 0) * MANIFOLD_SCALE;
  const minimumAxialWall = Math.max(650, bottomClearance * 2);
  const connectorThickness = Math.max(
    900,
    Math.min(1200, baseThickness - minimumAxialWall * 2 - clearance * 2),
  );
  const socketDepth = connectorThickness + clearance * 2;
  const socketZ = Math.max(bottomClearance, (baseThickness - socketDepth) / 2);
  const axialWall = Math.min(socketZ, baseThickness - socketDepth - socketZ);
  const connectorZ = socketZ + clearance;
  const letterSpacing = Math.max(0, (input.letterSpacing ?? 0) * MANIFOLD_SCALE);
  const glyphBounds = glyphs.reduce(
    (bounds, glyph) => ({
      min: Math.min(bounds.min, glyph.bounds.minY * MANIFOLD_SCALE),
      max: Math.max(bounds.max, glyph.bounds.maxY * MANIFOLD_SCALE),
    }),
    { min: Infinity, max: -Infinity },
  );
  const jointY = glyphBounds.min + (glyphBounds.max - glyphBounds.min) * 0.4;
  const prototypes: ArticulatedPrototype[] = [];
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyphOutline = wasm.CrossSection.ofPolygons(
      scalePolygons(glyphs[index].polygons),
      'EvenOdd',
    );
    const glyph = glyphExpansion
      ? glyphOutline.offset(glyphExpansion, 'Round', 2, 64)
      : glyphOutline.translate([0, 0]);
    glyphOutline.delete();
    const needsLeft = index > 0;
    const needsRight = index < glyphs.length - 1;
    let structural = glyph.translate([0, 0]);
    let leftAnchor: Vec2 | undefined;
    let rightAnchor: Vec2 | undefined;
    if (needsLeft) {
      const left = anchorForSide(glyph, jointY, 'left', chamberRadius, minimumWall);
      leftAnchor = left.anchor;
      structural = addJointBoss(wasm, structural, left.anchor, left.root, bossRadius);
    }
    if (needsRight) {
      const right = anchorForSide(glyph, jointY, 'right', chamberRadius, minimumWall);
      rightAnchor = right.anchor;
      structural = addJointBoss(wasm, structural, right.anchor, right.root, bossRadius);
    }
    if (index === 0) {
      const next = ringAssembly(
        wasm,
        structural,
        input.holeDiameter,
        input.keyringWall,
        'left',
        input.ringOffsetMm ?? 0,
      );
      structural.delete();
      structural = next;
    }
    const counterGuard = preserveCounters(wasm, structural, glyph);
    structural = counterGuard.section;
    const glyphBounds2d = sectionBounds(glyph);
    const structuralBounds = sectionBounds(structural);
    prototypes.push({
      glyph,
      structural,
      leftAnchor,
      rightAnchor,
      glyphBounds: glyphBounds2d,
      structuralBounds,
      countersPreserved: counterGuard.preserved,
    });
  }
  let nextLeft = 0;
  const offsets = prototypes.map((prototype) => {
    const offset = nextLeft - prototype.structuralBounds.min[0];
    nextLeft = offset + prototype.structuralBounds.max[0] + mechanicalGap + letterSpacing;
    return offset;
  });
  const centerOffset = -nextLeft / 2 + (mechanicalGap + letterSpacing) / 2;
  const parts: ArticulatedPart[] = [];
  for (let index = 0; index < prototypes.length; index += 1) {
    const prototype = prototypes[index];
    const offsetX = offsets[index] + centerOffset;
    const structural2d = prototype.structural.translate([offsetX, 0]);
    const glyph2d = prototype.glyph.translate([offsetX, 0]);
    const structuralBounds = sectionBounds(structural2d);
    const socketCuts: Solid[] = [];
    const leftAnchor =
      prototype.leftAnchor &&
      ([prototype.leftAnchor[0] + offsetX, prototype.leftAnchor[1]] as Vec2);
    const rightAnchor =
      prototype.rightAnchor &&
      ([prototype.rightAnchor[0] + offsetX, prototype.rightAnchor[1]] as Vec2);
    if (leftAnchor)
      socketCuts.push(
        articulatedSocket(
          wasm,
          leftAnchor,
          'left',
          structuralBounds.min[0],
          chamberRadius,
          bridgeWidth,
          clearance,
          connectorThickness,
          socketZ,
        ),
      );
    if (rightAnchor)
      socketCuts.push(
        articulatedSocket(
          wasm,
          rightAnchor,
          'right',
          structuralBounds.max[0],
          chamberRadius,
          bridgeWidth,
          clearance,
          connectorThickness,
          socketZ,
        ),
      );
    let body = structural2d.extrude(baseThickness);
    for (const socket of socketCuts) {
      const next = body.subtract(socket);
      body.delete();
      socket.delete();
      body = next;
    }
    const cap = glyph2d.extrude(reliefDepth).translate([0, 0, baseThickness]);
    const solid = body.add(cap);
    const glyphWorldBounds = sectionBounds(glyph2d);
    const centerX = (structuralBounds.min[0] + structuralBounds.max[0]) / 2;
    parts.push({
      body,
      cap,
      solid,
      centerX,
      width: structuralBounds.max[0] - structuralBounds.min[0],
      leftAnchor,
      rightAnchor,
      structuralArea: area(structural2d),
      structuralBounds,
      glyphBounds: glyphWorldBounds,
    });
    structural2d.delete();
    glyph2d.delete();
  }
  prototypes.forEach((prototype) => deleteAll([prototype.glyph, prototype.structural]));
  const connectors: Solid[] = [];
  for (let index = 0; index + 1 < parts.length; index += 1) {
    const leftAnchor = parts[index].rightAnchor;
    const rightAnchor = parts[index + 1].leftAnchor;
    if (!leftAnchor || !rightAnchor) continue;
    connectors.push(
      connectorSolid(
        wasm,
        leftAnchor,
        rightAnchor,
        headRadius,
        bridgeWidth,
        connectorThickness,
        connectorZ,
      ),
    );
  }
  const allSolids = [...parts.map((part) => part.solid), ...connectors];
  const bounds = aggregateBounds(allSolids);
  return {
    kind: 'articulated',
    parts,
    connectors,
    widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE,
    bounds,
    invariants: {
      headDiameter: headRadius * 2,
      throatWidth: bridgeWidth + clearance * 2,
      chamberDiameter: chamberRadius * 2,
      neckWidth,
      clearance,
      minimumWall,
      axialWall,
      minimumAxialWall,
      motionAllowance,
      countersPreserved: prototypes.every((prototype) => prototype.countersPreserved),
    },
  };
};
const nameplateStyle = (wasm: GeometryWasm, input: StyleInput): StyleBuild => {
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  const textDepth =
    (input.nameplateEmbedMm ?? 0.4) * MANIFOLD_SCALE + (input.reliefDepth ?? 1) * MANIFOLD_SCALE;
  const tiltMargin =
    Math.abs(Math.sin(((input.nameplateTiltDeg ?? 6) * Math.PI) / 180)) * textDepth;
  const border = effectiveMargin(input) + Math.max(0, input.reliefHaloMm ?? 0) * MANIFOLD_SCALE;
  const width = Math.max(34000, textWidth + border * 2);
  const height = Math.max(18000, textHeight + border * 2 + tiltMargin * 2);
  const radius = Math.max(
    1500,
    Math.min(input.cornerRadius ?? 4000, Math.min(width, height) / 2 - border - 250),
  );
  const plate = roundedRect(wasm, width, height, radius);
  return { backing: plate, relief: input.text, subtitle: input.subtitle };
};
const plantFoundation = (
  wasm: GeometryWasm,
  styleId: StyleId,
  width: number,
  height: number,
  radius: number,
  accentEnabled: boolean,
  bubbleLobeMm = 0,
  tagTailMm = 0,
  archCurveMm = 0,
): CrossSection => {
  const base = roundedRect(wasm, width, height, radius);
  if (!accentEnabled) return base;

  const bounds = sectionBounds(base);
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const minimumRadius = 2600;
  const accentRadius = (ratio: number): number => Math.max(minimumRadius, height * ratio);
  const accent = (radius: number, center: Vec2): CrossSection =>
    wasm.CrossSection.circle(radius, 64).translate(center);

  if (styleId === 'contour') {
    const topAccent = accent(Math.max(height * 0.9, width * 0.2), [
      centerX,
      bounds.max[1] + height * 0.25,
    ]);
    const result = union(wasm, [base, topAccent]);
    base.delete();
    topAccent.delete();
    return result;
  }
  if (styleId === 'capsule') {
    const radius = Math.max(height * 0.6, width * 0.12);
    const accents = [
      accent(radius, [bounds.min[0] + height * 0.28, centerY]),
      accent(radius, [bounds.max[0] - height * 0.28, centerY]),
    ];
    const result = union(wasm, [base, ...accents]);
    base.delete();
    accents.forEach((item) => item.delete());
    return result;
  }
  if (styleId === 'soft-tag') {
    const accent = wasm.CrossSection.circle(accentRadius(0.48) + tagTailMm * 1000, 64).translate([
      bounds.max[0] - height * 0.28,
      bounds.max[1] - height * 0.28,
    ]);
    const result = union(wasm, [base, accent]);
    base.delete();
    accent.delete();
    return result;
  }
  if (styleId === 'bubble') {
    const bubbles = [
      wasm.CrossSection.circle(accentRadius(0.44) + bubbleLobeMm * 1000, 64).translate([
        bounds.min[0] + height * 0.34,
        bounds.max[1] - height * 0.3,
      ]),
      wasm.CrossSection.circle(Math.max(2200, height * 0.34) + bubbleLobeMm * 1000, 64).translate([
        bounds.max[0] - height * 0.22,
        bounds.min[1] + height * 0.25,
      ]),
    ];
    const result = union(wasm, [base, ...bubbles]);
    base.delete();
    bubbles.forEach((bubble) => bubble.delete());
    return result;
  }
  if (styleId === 'arch') {
    const arch = wasm.CrossSection.circle(
      Math.max(height, width * 0.22) + archCurveMm * 1000,
      64,
    ).translate([(bounds.min[0] + bounds.max[0]) / 2, bounds.max[1] - height * 0.12]);
    const result = union(wasm, [base, arch]);
    base.delete();
    arch.delete();
    return result;
  }
  const inner = roundedRect(
    wasm,
    Math.max(10000, width - 4200),
    Math.max(2500, height - 2600),
    1000,
  );
  const result = base.subtract(inner);
  base.delete();
  inner.delete();
  return result;
};

const plantLabelStyle = (wasm: GeometryWasm, input: StyleInput, styleId: StyleId): StyleBuild => {
  const textWidth = input.textBounds.max[0] - input.textBounds.min[0];
  const textHeight = input.textBounds.max[1] - input.textBounds.min[1];
  const border = effectiveMargin(input) + Math.max(0, input.reliefHaloMm ?? 0) * MANIFOLD_SCALE;
  const foundationWidth = Math.max(34000, textWidth + border * 2 + 7000);
  const foundationHeight = Math.max(5000, Math.min(8000, textHeight * 0.26));
  const radius = Math.max(
    1200,
    Math.min(input.cornerRadius ?? 4000, Math.min(foundationWidth, foundationHeight) / 2 - 500),
  );
  const foundation = plantFoundation(
    wasm,
    styleId,
    foundationWidth,
    foundationHeight,
    styleId === 'capsule' ? foundationHeight / 2 : radius,
    input.plantAccentEnabled ?? true,
    input.bubbleLobeMm ?? 0,
    input.tagTailMm ?? 0,
    input.archCurveMm ?? 0,
  );
  const stakeTotal = Math.max(24000, (input.stakeLength ?? 48) * 1000);
  const tipHeight = Math.max(8000, Math.min(12000, stakeTotal * 0.16));
  const stakeWidth = Math.max(
    6000,
    Math.min(8500, foundationWidth * 0.18 + Math.max(0, input.stakeShoulderMm ?? 0) * 1000),
  );
  const foundationBottom = -foundationHeight / 2;
  const foundationTop = foundationHeight / 2;
  const shaftTop = foundationTop + 1000;
  const tipTop = foundationBottom - (stakeTotal - tipHeight);
  const shaftBottom = tipTop - 1000;
  const shaftHeight = Math.max(1000, shaftTop - shaftBottom);
  const shaft = wasm.CrossSection.square([stakeWidth, shaftHeight], true).translate([
    0,
    (shaftTop + shaftBottom) / 2,
  ]);
  const tip = wasm.CrossSection.ofPolygons(
    [
      [
        [-stakeWidth / 2, tipTop],
        [stakeWidth / 2, tipTop],
        [0, tipTop - tipHeight],
      ],
    ],
    'EvenOdd',
  );
  const textOffsetY = foundationBottom + 1000 - input.textBounds.min[1];
  const labelText = input.text.translate([0, textOffsetY]);
  const labelFootprint = input.text.translate([0, textOffsetY]);
  const labelSubtitle = input.subtitle?.translate([0, textOffsetY]);
  const subtitleFootprint = labelSubtitle
    ? labelSubtitle.offset(effectiveMargin(input), 'Round', 2, 64)
    : undefined;
  const joined = union(
    wasm,
    subtitleFootprint
      ? [foundation, shaft, tip, labelFootprint, subtitleFootprint]
      : [foundation, shaft, tip, labelFootprint],
  );
  foundation.delete();
  shaft.delete();
  tip.delete();
  labelFootprint.delete();
  subtitleFootprint?.delete();
  return {
    backing: joined,
    relief: labelText,
    subtitle: labelSubtitle,
    reliefDepthMm: Math.min(2, Math.max(0.6, input.reliefDepth ?? 0.7)),
  };
};
export const buildTemplate = (
  wasm: GeometryWasm,
  templateId: TemplateId,
  styleId: StyleId,
  input: StyleInput,
): TemplateBuild => {
  const build =
    templateId === 'articulated-name'
      ? articulatedStyle(wasm, input)
      : templateId === 'nameplate'
        ? nameplateStyle(wasm, input)
        : templateId === 'plant-label'
          ? plantLabelStyle(wasm, input, styleId)
          : buildStyle(wasm, styleId, input);
  return {
    ...build,
    constraints: input.constraints ?? DEFAULT_GEOMETRY_CONSTRAINTS,
    printProfile: input.printProfile ?? DEFAULT_PRINT_PROFILE,
  };
};
export const isArticulatedBuild = (build: TemplateBuild): build is ArticulatedBuild => {
  return 'kind' in build && build.kind === 'articulated';
};
export const releaseArticulatedBuild = (build: ArticulatedBuild): void => {
  deleteAll([
    ...build.parts.flatMap((part) => [part.body, part.cap, part.solid]),
    ...build.connectors,
  ]);
};
