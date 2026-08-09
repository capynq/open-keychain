import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import { fontDefinition, fontSupportsArticulatedName, type FontDefinition } from '../fonts/catalog';
import { flattenText, flattenTextGlyphs, hasRequiredGlyphs, type GlyphOutline } from './text';
import {
  buildTemplate,
  isArticulatedBuild,
  releaseArticulatedBuild,
  type ArticulatedBuild,
  type TemplateBuild,
} from './templates';
import {
  ARTICULATED_PRINT_APPEARANCE,
  DEFAULT_PRINT_APPEARANCE,
  keyringMetrics,
  normalizeParams,
  type GeometryResult,
  type KeychainParams,
  type MeshBuffer,
  type ValidationIssue,
} from './types';

const MAX_WIDTH_MM = 120;
const MIN_TEXT_HEIGHT_MM = 12;
const MANIFOLD_SCALE = 1000;
const WIDTH_FIT_ITERATIONS = 6;

/**
 * opentype.js reads the default instance of Google variable TTFs and does not expose their `wght` axis.
 * Dilation in final model space keeps the articulated result at the advertised heavy weight while preserving
 * one source of truth for the printable glyph outline and its counters.
 */
function articulatedGlyphDilationMm(templateId: KeychainParams['templateId'], definition: FontDefinition): number {
  if (templateId !== 'articulated-name') return 0;
  return definition.articulatedDilationMm ?? 0.55;
}

function parseFont(buffer: ArrayBuffer): opentype.Font {
  const module = opentype as unknown as {
    parse?: (data: ArrayBuffer) => opentype.Font;
    default?: { parse: (data: ArrayBuffer) => opentype.Font };
  };
  const parse = module.parse ?? module.default?.parse;
  if (!parse) throw new Error('OpenType parser is unavailable.');
  return parse(buffer);
}

type Wasm = Awaited<ReturnType<typeof Module>>;

function asMesh(manifold: any): MeshBuffer {
  const mesh = manifold.getMesh();
  const positions = new Float32Array(mesh.numVert * 3);
  for (let vertex = 0; vertex < mesh.numVert; vertex += 1) {
    const source = mesh.position(vertex);
    positions[vertex * 3] = source[0] / MANIFOLD_SCALE;
    positions[vertex * 3 + 1] = source[1] / MANIFOLD_SCALE;
    positions[vertex * 3 + 2] = source[2] / MANIFOLD_SCALE;
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}

function mergeMeshes(meshes: MeshBuffer[]): MeshBuffer {
  const positions = new Float32Array(meshes.reduce((sum, mesh) => sum + mesh.positions.length, 0));
  const indices = new Uint32Array(meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0));
  let positionOffset = 0;
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const mesh of meshes) {
    positions.set(mesh.positions, positionOffset);
    for (let index = 0; index < mesh.indices.length; index += 1)
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    positionOffset += mesh.positions.length;
    vertexOffset += mesh.positions.length / 3;
    indexOffset += mesh.indices.length;
  }
  return { positions, indices };
}

function scalePolygons(polygons: Array<Array<[number, number]>>, factor: number): Array<Array<[number, number]>> {
  return polygons.map((polygon) =>
    polygon.map(([x, y]) => [Math.round(x * factor * MANIFOLD_SCALE), Math.round(y * factor * MANIFOLD_SCALE)]),
  );
}

function scaleGlyphs(glyphs: GlyphOutline[], factor: number): GlyphOutline[] {
  return glyphs.map((glyph) => ({
    ...glyph,
    polygons: glyph.polygons.map((polygon) => polygon.map(([x, y]) => [x * factor, y * factor] as [number, number])),
    bounds: {
      minX: glyph.bounds.minX * factor,
      minY: glyph.bounds.minY * factor,
      maxX: glyph.bounds.maxX * factor,
      maxY: glyph.bounds.maxY * factor,
    },
    width: glyph.width * factor,
    height: glyph.height * factor,
    advance: glyph.advance * factor,
  }));
}

function deleteAll(items: any[]): void {
  items.forEach((item) => {
    try {
      item.delete();
    } catch (error) {
      void error;
    }
  });
}

function validateMesh(mesh: MeshBuffer): boolean {
  return [...mesh.positions].every(Number.isFinite) && [...mesh.indices].every(Number.isFinite);
}

function finiteBounds(bounds: { min: number[]; max: number[] }): boolean {
  return [...bounds.min, ...bounds.max].every(Number.isFinite);
}

function sectionArea(section: any): number {
  const polygonArea = (polygon: Array<[number, number]>) =>
    polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2;
  return Math.abs(
    (section.toPolygons() as Array<Array<[number, number]>>).reduce((area, polygon) => area + polygonArea(polygon), 0),
  );
}

function hasSolidIntersection(left: any, right: any): boolean {
  const intersection = left.intersect(right);
  const collision = intersection.numTri() > 0;
  intersection.delete();
  return collision;
}

function motionEnvelopeValid(build: ArticulatedBuild, maxAngleDeg: number): boolean {
  const angles = [-maxAngleDeg, -maxAngleDeg / 2, 0, maxAngleDeg / 2, maxAngleDeg];
  return angles.every((angle) => {
    const excursion = Math.abs(Math.sin((angle * Math.PI) / 180)) * build.invariants.neckWidth * 0.25;
    return (
      build.invariants.chamberDiameter >= build.invariants.headDiameter + build.invariants.clearance * 2 + excursion * 2
    );
  });
}

function articulatedValidation(build: ArticulatedBuild, params: KeychainParams, issues: ValidationIssue[]): boolean {
  const expectedSolids = build.parts.length * 2 - 1;
  const meshes = [
    ...build.parts.flatMap((part) => [asMesh(part.body), asMesh(part.cap), asMesh(part.solid)]),
    ...build.connectors.map(asMesh),
  ];
  const manifoldValid = [
    ...build.parts.flatMap((part) => [part.body, part.cap, part.solid]),
    ...build.connectors,
  ].every((solid) => solid.status() === 'NoError');
  const rigidPartsValid = build.parts.every((part) => {
    const components = part.solid.decompose();
    const valid = components.length === 1;
    components.forEach((component: any) => component.delete());
    return valid;
  });
  if (build.parts.length < 2 || build.connectors.length !== build.parts.length - 1) {
    issues.push({
      severity: 'error',
      code: 'articulated-shell-count',
      message: 'The articulated name did not produce one carrier per letter and one connector per gap.',
    });
  }
  if (!manifoldValid || !rigidPartsValid || !meshes.every(validateMesh)) {
    issues.push({
      severity: 'error',
      code: 'articulated-manifold',
      message: 'An articulated carrier or connector is not a valid printable solid.',
    });
  }
  const invariants = build.invariants;
  if (
    invariants.headDiameter <= invariants.throatWidth ||
    invariants.neckWidth + invariants.clearance * 2 > invariants.throatWidth ||
    invariants.headDiameter + invariants.clearance * 2 > invariants.chamberDiameter ||
    invariants.minimumWall < params.minimumWallMm * MANIFOLD_SCALE ||
    invariants.axialWall < invariants.minimumAxialWall
  ) {
    issues.push({
      severity: 'error',
      code: 'articulated-captive',
      message: 'The articulated connector does not satisfy its captive-head and wall-thickness constraints.',
    });
  }
  if (!invariants.countersPreserved) {
    issues.push({
      severity: 'error',
      code: 'articulated-counter',
      message: 'A structural joint filled a glyph counter that must remain open.',
    });
  }
  for (let index = 0; index + 1 < build.parts.length; index += 1) {
    if (hasSolidIntersection(build.parts[index].solid, build.parts[index + 1].solid)) {
      issues.push({
        severity: 'error',
        code: 'articulated-body-collision',
        message: 'Adjacent articulated carriers overlap in the neutral pose.',
      });
      break;
    }
    const leftConnectorCollision = hasSolidIntersection(build.parts[index].solid, build.connectors[index]);
    const rightConnectorCollision = hasSolidIntersection(build.parts[index + 1].solid, build.connectors[index]);
    if (leftConnectorCollision || rightConnectorCollision) {
      issues.push({
        severity: 'error',
        code: 'articulated-connector-collision',
        message: `A captive connector intersects a carrier instead of having printable clearance (joint ${index}, left=${leftConnectorCollision}, right=${rightConnectorCollision}).`,
      });
      break;
    }
  }
  if (!motionEnvelopeValid(build, params.maxJointAngleDeg)) {
    issues.push({
      severity: 'error',
      code: 'articulated-motion-collision',
      message: 'Adjacent articulated carriers collide within the configured movement range.',
    });
  }
  return (
    issues.every((issue) => issue.severity !== 'error') &&
    manifoldValid &&
    expectedSolids === build.parts.length * 2 - 1
  );
}

export async function createWasm(): Promise<Wasm> {
  const isBrowser = typeof (globalThis as { window?: unknown }).window !== 'undefined';
  const wasmPath = isBrowser ? '/manifold.wasm' : new URL('../../public/manifold.wasm', import.meta.url).pathname;
  const wasm = await Module({ locateFile: () => wasmPath });
  wasm.setup();
  return wasm;
}

type StandardStyledGeometry = {
  kind: 'standard';
  scale: number;
  rawText: any;
  relief: any;
  backing: any;
  recesses: Array<{ section: any; depthMm: number }>;
  reliefDepthMm?: number;
  widthMm: number;
};

type ArticulatedStyledGeometry = {
  kind: 'articulated';
  scale: number;
  rawText: any;
  build: ArticulatedBuild;
  widthMm: number;
};

type StyledGeometry = StandardStyledGeometry | ArticulatedStyledGeometry;

function releaseStyledGeometry(geometry: StyledGeometry): void {
  if (geometry.kind === 'articulated') {
    releaseArticulatedBuild(geometry.build);
    geometry.rawText.delete();
    return;
  }
  deleteAll([
    geometry.backing,
    ...new Set([geometry.rawText, geometry.relief]),
    ...geometry.recesses.map((item) => item.section),
  ]);
}

function finalizeArticulated(
  build: ArticulatedBuild,
  rawText: any,
  scale: number,
  params: KeychainParams,
  issues: ValidationIssue[],
  includeExport: boolean,
): { result: GeometryResult; exportMesh?: MeshBuffer } {
  const baseMesh = mergeMeshes([...build.parts.map((part) => asMesh(part.body)), ...build.connectors.map(asMesh)]);
  const reliefMesh = mergeMeshes(build.parts.map((part) => asMesh(part.cap)));
  const exportMesh = includeExport
    ? mergeMeshes([...build.parts.map((part) => asMesh(part.solid)), ...build.connectors.map(asMesh)])
    : undefined;
  const valid = articulatedValidation(build, params, issues);
  if (params.reliefDepthMm < 0.5)
    issues.push({
      severity: 'warning',
      code: 'shallow-relief',
      message: 'A slightly taller text relief is easier to see after printing.',
    });
  const triangleCount = exportMesh?.indices.length
    ? exportMesh.indices.length / 3
    : build.parts.reduce((sum, part) => sum + part.solid.numTri(), 0);
  if (triangleCount > 12000)
    issues.push({
      severity: 'warning',
      code: 'dense-mesh',
      message: 'This articulated model exceeds 12,000 triangles and may take longer to slice.',
    });
  const bounds = build.bounds;
  const result: GeometryResult = {
    generationId: 0,
    baseMesh,
    reliefMesh,
    dimensions: {
      widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE,
      heightMm: (bounds.max[1] - bounds.min[1]) / MANIFOLD_SCALE,
      thicknessMm: (bounds.max[2] - bounds.min[2]) / MANIFOLD_SCALE,
      centerMm: [
        (bounds.max[0] + bounds.min[0]) / (MANIFOLD_SCALE * 2),
        (bounds.max[1] + bounds.min[1]) / (MANIFOLD_SCALE * 2),
        (bounds.max[2] + bounds.min[2]) / (MANIFOLD_SCALE * 2),
      ],
    },
    issues,
    printable: valid && finiteBounds(bounds) && validateMesh(baseMesh) && validateMesh(reliefMesh),
    appearance: ARTICULATED_PRINT_APPEARANCE,
    solidCount: build.parts.length * 2 - 1,
  };
  releaseArticulatedBuild(build);
  rawText.delete();
  void scale;
  return { result, exportMesh };
}

/** Build validated printable geometry, fitting finished backing dimensions before tessellation. */
export async function buildKeychain(
  wasm: Wasm,
  input: KeychainParams,
  includeExport = false,
): Promise<{ result: GeometryResult; exportMesh?: MeshBuffer }> {
  const params = normalizeParams(input);
  const issues: ValidationIssue[] = [];
  if (input.templateId === 'articulated-name' && input.baseThicknessMm < 3.4)
    issues.push({
      severity: 'warning',
      code: 'articulated-base-adjusted',
      message: 'Base thickness was adjusted to 3.4 mm so the captive joints retain printable top and bottom walls.',
    });
  if (!params.text) return invalidResult(issues, 'empty-text', 'Enter a name to create your keychain.');
  if ([...params.text].length > 24)
    return invalidResult(issues, 'text-too-long', 'Shorten the name to 24 characters or fewer.');

  const definition = fontDefinition(params.fontId);
  if (params.templateId === 'articulated-name' && !fontSupportsArticulatedName(definition, params.text))
    return invalidResult(
      issues,
      'articulated-font',
      `${definition.name} is not available for articulated letters. Choose a supported heavy font.`,
    );
  const response = await fetch(definition.file);
  if (!response.ok) return invalidResult(issues, 'font-load', `Could not load the ${definition.name} font.`);
  const font = parseFont(await response.arrayBuffer());
  const missing = hasRequiredGlyphs(font, params.text);
  if (missing)
    return invalidResult(issues, 'missing-glyph', `The ${definition.name} font does not contain “${missing}”.`);

  const outline = flattenText(font, params.text, params.textHeightMm, params.letterSpacingMm);
  if (!outline.polygons.length || outline.width <= 0 || outline.height <= 0)
    return invalidResult(issues, 'empty-outline', 'This name does not produce a usable outline.');
  const articulatedGlyphs =
    params.templateId === 'articulated-name' ? flattenTextGlyphs(font, params.text, params.textHeightMm) : undefined;
  if (params.templateId === 'articulated-name' && !articulatedGlyphs?.some((glyph) => glyph.polygons.length))
    return invalidResult(issues, 'empty-outline', 'This name does not produce usable articulated glyphs.');

  const keyring = keyringMetrics(params.holeDiameterMm);
  const articulatedOutlineExpansionMm = articulatedGlyphDilationMm(params.templateId, definition);
  const buildStyledGeometry = (scale: number): StyledGeometry => {
    const text = wasm.CrossSection.ofPolygons(scalePolygons(outline.polygons, scale), 'EvenOdd');
    const rawBounds = text.bounds();
    const textBounds = {
      min: [rawBounds.min[0], rawBounds.min[1]] as [number, number],
      max: [rawBounds.max[0], rawBounds.max[1]] as [number, number],
    };
    const style: TemplateBuild = buildTemplate(wasm, params.templateId, params.styleId, {
      text,
      textBounds,
      padding: params.paddingMm * MANIFOLD_SCALE,
      letterSpacing: params.letterSpacingMm,
      holeDiameter: params.holeDiameterMm * MANIFOLD_SCALE,
      keyringWall: keyring.wallMm * MANIFOLD_SCALE,
      templateId: params.templateId,
      connectorWidth: params.connectorWidthMm,
      cornerRadius: params.cornerRadiusMm * MANIFOLD_SCALE,
      stakeLength: params.stakeLengthMm,
      glyphs: articulatedGlyphs ? scaleGlyphs(articulatedGlyphs, scale) : undefined,
      baseThickness: params.baseThicknessMm,
      reliefDepth: params.reliefDepthMm,
      jointClearance: params.jointClearanceMm,
      mechanicalGap: params.mechanicalGapMm,
      maxJointAngleDeg: params.maxJointAngleDeg,
      minimumWall: params.minimumWallMm,
      bottomClearance: params.bottomClearanceMm,
      articulatedOutlineExpansionMm,
    });
    if (isArticulatedBuild(style))
      return { kind: 'articulated', scale, rawText: text, build: style, widthMm: style.widthMm };
    const bounds = style.backing.bounds();
    return {
      kind: 'standard',
      scale,
      rawText: text,
      relief: style.relief,
      backing: style.backing,
      recesses: style.recesses ?? [],
      reliefDepthMm: style.reliefDepthMm,
      widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE,
    };
  };

  let styled = buildStyledGeometry(1);
  if (styled.widthMm > MAX_WIDTH_MM) {
    let highWidth = styled.widthMm;
    const minimumScale = MIN_TEXT_HEIGHT_MM / params.textHeightMm;
    if (minimumScale >= 1) {
      releaseStyledGeometry(styled);
      return invalidResult(
        issues,
        'text-too-wide',
        'This name cannot fit within 120 mm at the minimum 12 mm text height. Shorten the name or choose a narrower font.',
      );
    }
    const minimum = buildStyledGeometry(minimumScale);
    if (minimum.widthMm > MAX_WIDTH_MM) {
      releaseStyledGeometry(styled);
      releaseStyledGeometry(minimum);
      return invalidResult(
        issues,
        'text-too-wide',
        'This name cannot fit within 120 mm without making the text smaller than 12 mm. Shorten the name or choose a narrower font.',
      );
    }
    releaseStyledGeometry(styled);
    styled = minimum;
    let low = minimumScale;
    let lowWidth = minimum.widthMm;
    let high = 1;
    for (let iteration = 0; iteration < WIDTH_FIT_ITERATIONS; iteration += 1) {
      const interpolated = low + ((high - low) * (MAX_WIDTH_MM - lowWidth)) / Math.max(highWidth - lowWidth, 0.001);
      const candidateScale = Math.max(low + (high - low) * 0.1, Math.min(high - (high - low) * 0.1, interpolated));
      const candidate = buildStyledGeometry(candidateScale);
      if (candidate.widthMm <= MAX_WIDTH_MM) {
        releaseStyledGeometry(styled);
        styled = candidate;
        low = candidateScale;
        lowWidth = candidate.widthMm;
        if (MAX_WIDTH_MM - candidate.widthMm <= 0.1) break;
      } else {
        highWidth = candidate.widthMm;
        releaseStyledGeometry(candidate);
        high = candidateScale;
      }
    }
    issues.push({
      severity: 'warning',
      code: 'scaled-to-fit',
      message: `The name was adjusted to ${(params.textHeightMm * styled.scale).toFixed(1)} mm high to keep the finished keychain within 120 mm.`,
    });
  }

  if (styled.kind === 'articulated')
    return finalizeArticulated(styled.build, styled.rawText, styled.scale, params, issues, includeExport);

  const textSection = styled.relief;
  const styleBase = styled.backing;
  const uncoveredRelief = textSection.subtract(styleBase);
  const reliefContained = sectionArea(uncoveredRelief) <= 1;
  uncoveredRelief.delete();
  if (!reliefContained)
    issues.push({
      severity: 'error',
      code: 'relief-outside-backing',
      message: 'The raised text extends beyond its foundation. Choose another style or adjust the name.',
    });
  const baseThickness = Math.round(params.baseThicknessMm * MANIFOLD_SCALE);
  let base = styleBase.extrude(baseThickness);
  const maxRecessDepth = Math.max(0, baseThickness - 600);
  const recessDepth = styled.recesses.length
    ? Math.min(maxRecessDepth, Math.round(Math.max(...styled.recesses.map((item) => item.depthMm * MANIFOLD_SCALE))))
    : 0;
  if (recessDepth > 0) {
    for (const item of styled.recesses) {
      const cutSolid = item.section.extrude(recessDepth).translate([0, 0, baseThickness - recessDepth]);
      const nextBase = base.subtract(cutSolid);
      base.delete();
      cutSolid.delete();
      base = nextBase;
    }
  }
  const effectiveReliefDepthMm = styled.reliefDepthMm ?? params.reliefDepthMm;
  const relief = textSection
    .extrude(Math.round((effectiveReliefDepthMm + 0.15) * MANIFOLD_SCALE))
    .translate([0, 0, baseThickness - Math.max(recessDepth, 0) - 150]);
  const model = base.add(relief);
  const bounds = model.boundingBox();
  const baseMesh = asMesh(base);
  const reliefMesh = asMesh(relief);
  const exportMesh = includeExport ? asMesh(model) : undefined;
  const components = model.decompose();
  const connected = components.length === 1;
  deleteAll(components);
  const printable =
    model.status() === 'NoError' &&
    connected &&
    reliefContained &&
    finiteBounds(bounds) &&
    validateMesh(baseMesh) &&
    validateMesh(reliefMesh);
  if (!connected)
    issues.push({
      severity: 'error',
      code: 'disconnected',
      message: 'Some parts of the name are not connected. Increase padding or choose another style.',
    });
  if (model.numTri() > 12000)
    issues.push({
      severity: 'warning',
      code: 'dense-mesh',
      message: 'This curved model exceeds 12,000 triangles and may take longer to slice.',
    });
  if (params.reliefDepthMm < 0.5)
    issues.push({
      severity: 'warning',
      code: 'shallow-relief',
      message: 'A slightly taller text relief is easier to see after printing.',
    });
  const result: GeometryResult = {
    generationId: 0,
    baseMesh,
    reliefMesh,
    dimensions: {
      widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE,
      heightMm: (bounds.max[1] - bounds.min[1]) / MANIFOLD_SCALE,
      thicknessMm: (bounds.max[2] - bounds.min[2]) / MANIFOLD_SCALE,
      centerMm: [
        (bounds.max[0] + bounds.min[0]) / (MANIFOLD_SCALE * 2),
        (bounds.max[1] + bounds.min[1]) / (MANIFOLD_SCALE * 2),
        (bounds.max[2] + bounds.min[2]) / (MANIFOLD_SCALE * 2),
      ],
    },
    issues,
    printable,
    appearance: DEFAULT_PRINT_APPEARANCE,
    baseShading: params.templateId === 'plant-label' ? 'flat' : 'creased',
    solidCount: 1,
  };
  deleteAll([
    model,
    relief,
    base,
    styleBase,
    ...new Set([styled.rawText, textSection]),
    ...styled.recesses.map((item) => item.section),
  ]);
  return { result, exportMesh };
}

function invalidResult(issues: ValidationIssue[], code: string, message: string): { result: GeometryResult } {
  issues.push({ severity: 'error', code, message });
  return {
    result: {
      generationId: 0,
      baseMesh: { positions: new Float32Array(), indices: new Uint32Array() },
      reliefMesh: { positions: new Float32Array(), indices: new Uint32Array() },
      dimensions: { widthMm: 0, heightMm: 0, thicknessMm: 0, centerMm: [0, 0, 0] },
      issues,
      printable: false,
      appearance: DEFAULT_PRINT_APPEARANCE,
      solidCount: 0,
    },
  };
}
