import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import { fontDefinition, fontSupportsArticulatedName, type FontDefinition } from '../fonts/catalog';
import {
  flattenText,
  flattenTextGlyphs,
  hasRequiredGlyphs,
  type GlyphOutline,
} from '../text/outline';
import {
  buildTemplate,
  isArticulatedBuild,
  releaseArticulatedBuild,
  type ArticulatedBuild,
  type TemplateBuild,
} from '../templates/template-builder';
import {
  ARTICULATED_PRINT_APPEARANCE,
  DEFAULT_PRINT_APPEARANCE,
  keyringMetrics,
  normalizeParams,
  type GeometryResult,
  type KeychainParams,
  type MeshBuffer,
  type ValidationIssue,
} from '../model/types';
import type { CrossSection, GeometryWasm } from '../../../infrastructure/geometry/manifold-types';
import { validateArticulatedBuild } from './articulated-validation';
import { buildNameplate } from '../templates/nameplate-builder';
import type { StandardStyledGeometry } from './styled-types';
import {
  MANIFOLD_SCALE,
  asMesh,
  disposeGeometry,
  finiteBounds,
  mergeMeshes,
  sectionArea,
  validateMesh,
} from '../../../infrastructure/geometry/manifold-utils';
const MAX_WIDTH_MM = 120;
const MIN_TEXT_HEIGHT_MM = 12;
const WIDTH_FIT_ITERATIONS = 6;
/**
 * opentype.js reads the default instance of Google variable TTFs and does not expose their `wght` axis.
 * Dilation in final model space keeps the articulated result at the advertised heavy weight while preserving
 * one source of truth for the printable glyph outline and its counters.
 */
const articulatedGlyphDilationMm = (
  templateId: KeychainParams['templateId'],
  definition: FontDefinition,
): number => {
  if (templateId !== 'articulated-name') return 0;
  return definition.articulatedDilationMm ?? 0.55;
};
const parseFont = (buffer: ArrayBuffer): opentype.Font => {
  const module = opentype as unknown as {
    parse?: (data: ArrayBuffer) => opentype.Font;
    default?: {
      parse: (data: ArrayBuffer) => opentype.Font;
    };
  };
  const parse = module.parse ?? module.default?.parse;
  if (!parse) throw new Error('OpenType parser is unavailable.');
  return parse(buffer);
};
type Wasm = GeometryWasm;
const scalePolygons = (
  polygons: Array<Array<[number, number]>>,
  factor: number,
): Array<Array<[number, number]>> => {
  return polygons.map((polygon) =>
    polygon.map(([x, y]) => [
      Math.round(x * factor * MANIFOLD_SCALE),
      Math.round(y * factor * MANIFOLD_SCALE),
    ]),
  );
};
const scaleGlyphs = (glyphs: GlyphOutline[], factor: number): GlyphOutline[] => {
  return glyphs.map((glyph) => ({
    ...glyph,
    polygons: glyph.polygons.map((polygon) =>
      polygon.map(([x, y]) => [x * factor, y * factor] as [number, number]),
    ),
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
};
const deleteAll = disposeGeometry;
export const createWasm = async (): Promise<Wasm> => {
  const isBrowserRuntime =
    typeof (
      globalThis as {
        window?: unknown;
      }
    ).window !== 'undefined';
  const isWorkerRuntime = typeof self !== 'undefined';
  const wasmPath =
    isBrowserRuntime || isWorkerRuntime
      ? '/manifold.wasm'
      : new URL('../../../../public/manifold.wasm', import.meta.url).pathname;
  const wasm = await Module({ locateFile: () => wasmPath });
  wasm.setup();
  return wasm;
};
type ArticulatedStyledGeometry = {
  kind: 'articulated';
  scale: number;
  rawText: CrossSection;
  build: ArticulatedBuild;
  widthMm: number;
};
type StyledGeometry = StandardStyledGeometry | ArticulatedStyledGeometry;
const releaseStyledGeometry = (geometry: StyledGeometry): void => {
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
};
const finalizeArticulated = (
  build: ArticulatedBuild,
  rawText: CrossSection,
  scale: number,
  params: KeychainParams,
  issues: ValidationIssue[],
  includeExport: boolean,
): {
  result: GeometryResult;
  exportMesh?: MeshBuffer;
} => {
  const baseMesh = mergeMeshes([
    ...build.parts.map((part) => asMesh(part.body)),
    ...build.connectors.map(asMesh),
  ]);
  const reliefMesh = mergeMeshes(build.parts.map((part) => asMesh(part.cap)));
  const exportMesh = includeExport
    ? mergeMeshes([
        ...build.parts.map((part) => asMesh(part.solid)),
        ...build.connectors.map(asMesh),
      ])
    : undefined;
  const valid = validateArticulatedBuild(build, params, issues);
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
};
/** Build validated printable geometry, fitting finished backing dimensions before tessellation. */
export const buildKeychain = async (
  wasm: Wasm,
  input: KeychainParams,
  includeExport = false,
): Promise<{
  result: GeometryResult;
  exportMesh?: MeshBuffer;
}> => {
  const params = normalizeParams(input);
  const issues: ValidationIssue[] = [];
  if (input.templateId === 'articulated-name' && input.baseThicknessMm < 3.4)
    issues.push({
      severity: 'warning',
      code: 'articulated-base-adjusted',
      message:
        'Base thickness was adjusted to 3.4 mm so the captive joints retain printable top and bottom walls.',
    });
  if (!params.text)
    return invalidResult(issues, 'empty-text', 'Enter a name to create your keychain.');
  if ([...params.text].length > 24)
    return invalidResult(issues, 'text-too-long', 'Shorten the name to 24 characters or fewer.');
  const definition = fontDefinition(params.fontId);
  if (
    params.templateId === 'articulated-name' &&
    !fontSupportsArticulatedName(definition, params.text)
  )
    return invalidResult(
      issues,
      'articulated-font',
      `${definition.name} is not available for articulated letters. Choose a supported heavy font.`,
    );
  const response = await fetch(definition.file);
  if (!response.ok)
    return invalidResult(issues, 'font-load', `Could not load the ${definition.name} font.`);
  const font = parseFont(await response.arrayBuffer());
  const missing = hasRequiredGlyphs(font, params.text);
  if (missing)
    return invalidResult(
      issues,
      'missing-glyph',
      `The ${definition.name} font does not contain “${missing}”.`,
    );
  const outline = flattenText(font, params.text, params.textHeightMm, params.letterSpacingMm);
  if (!outline.polygons.length || outline.width <= 0 || outline.height <= 0)
    return invalidResult(issues, 'empty-outline', 'This name does not produce a usable outline.');
  const articulatedGlyphs =
    params.templateId === 'articulated-name'
      ? flattenTextGlyphs(font, params.text, params.textHeightMm)
      : undefined;
  if (
    params.templateId === 'articulated-name' &&
    !articulatedGlyphs?.some((glyph) => glyph.polygons.length)
  )
    return invalidResult(
      issues,
      'empty-outline',
      'This name does not produce usable articulated glyphs.',
    );
  const keyring = keyringMetrics(params.holeDiameterMm);
  const articulatedOutlineExpansionMm = articulatedGlyphDilationMm(params.templateId, definition);
  const buildStyledGeometry = (scale: number): StyledGeometry => {
    const rawText = wasm.CrossSection.ofPolygons(scalePolygons(outline.polygons, scale), 'EvenOdd');
    const text =
      params.templateId === 'articulated-name' || params.fontWeightMm <= 0
        ? rawText.translate([0, 0])
        : rawText.offset(params.fontWeightMm * MANIFOLD_SCALE, 'Round', 2, 64);
    rawText.delete();
    const rawBounds = text.bounds();
    const textBounds = {
      min: [rawBounds.min[0], rawBounds.min[1]] as [number, number],
      max: [rawBounds.max[0], rawBounds.max[1]] as [number, number],
    };
    const style: TemplateBuild = buildTemplate(wasm, params.templateId, params.styleId, {
      text,
      textBounds,
      padding: params.paddingMm * MANIFOLD_SCALE,
      textInset:
        params.templateId === 'articulated-name' ? undefined : params.edgeInsetMm * MANIFOLD_SCALE,
      letterFillWidth: params.letterFillMm * MANIFOLD_SCALE,
      letterSpacing: params.letterSpacingMm,
      holeDiameter: params.holeDiameterMm * MANIFOLD_SCALE,
      keyringWall: keyring.wallMm * MANIFOLD_SCALE,
      templateId: params.templateId,
      connectorWidth: params.connectorWidthMm,
      cornerRadius: params.cornerRadiusMm * MANIFOLD_SCALE,
      stakeLength: params.stakeLengthMm,
      nameplateTiltDeg: params.nameplateTiltDeg,
      nameplateEmbedMm: params.nameplateEmbedMm,
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
      const interpolated =
        low + ((high - low) * (MAX_WIDTH_MM - lowWidth)) / Math.max(highWidth - lowWidth, 0.001);
      const candidateScale = Math.max(
        low + (high - low) * 0.1,
        Math.min(high - (high - low) * 0.1, interpolated),
      );
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
    return finalizeArticulated(
      styled.build,
      styled.rawText,
      styled.scale,
      params,
      issues,
      includeExport,
    );
  if (params.templateId === 'nameplate')
    return buildNameplate(wasm, styled, params, issues, includeExport);
  const textSection = styled.relief;
  const styleBase = styled.backing;
  const uncoveredRelief = textSection.subtract(styleBase);
  const reliefContained = sectionArea(uncoveredRelief) <= 1;
  uncoveredRelief.delete();
  if (!reliefContained)
    issues.push({
      severity: 'error',
      code: 'relief-outside-backing',
      message:
        'The raised text extends beyond its foundation. Choose another style or adjust the name.',
    });
  const baseThickness = Math.round(params.baseThicknessMm * MANIFOLD_SCALE);
  let base = styleBase.extrude(baseThickness);
  const maxRecessDepth = Math.max(0, baseThickness - 600);
  const recessDepth = styled.recesses.length
    ? Math.min(
        maxRecessDepth,
        Math.round(Math.max(...styled.recesses.map((item) => item.depthMm * MANIFOLD_SCALE))),
      )
    : 0;
  if (recessDepth > 0) {
    for (const item of styled.recesses) {
      const cutSolid = item.section
        .extrude(recessDepth)
        .translate([0, 0, baseThickness - recessDepth]);
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
      message:
        'Some parts of the name are not connected. Increase padding or choose another style.',
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
};
const invalidResult = (
  issues: ValidationIssue[],
  code: string,
  message: string,
): {
  result: GeometryResult;
} => {
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
};
