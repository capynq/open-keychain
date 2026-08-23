import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import {
  effectiveFontWeightMm,
  fontDefinition,
  fontSupportsArticulatedName,
  type FontDefinition,
} from '../fonts/catalog';
import { flattenText, hasRequiredGlyphs, layoutText, type GlyphOutline } from '../text/outline';
import {
  buildTemplate,
  isArticulatedBuild,
  releaseArticulatedBuild,
  type ArticulatedBuild,
  type TemplateBuild,
} from '../templates/template-builder';
import {
  ARTICULATED_PRINT_APPEARANCE,
  DEFAULT_GEOMETRY_CONSTRAINTS,
  DEFAULT_PRINT_APPEARANCE,
  DEFAULT_PRINT_PROFILE,
  keyringMetrics,
  normalizeParams,
  geometryConstraintsFor,
  printProfileFor,
  MAGNET_SUBTITLE_MAX_LENGTH,
  type GeometryResult,
  type KeychainParams,
  type MeshBuffer,
  type ValidationIssue,
} from '../model/types';
import type { CrossSection, GeometryWasm } from '../../../infrastructure/geometry/manifold-types';
import { validateArticulatedBuild } from './articulated-validation';
import { buildNameplate } from '../templates/nameplate-builder';
import type { StandardStyledGeometry } from './styled-types';
import { archWarp } from '../styles/style-builder';
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
const fontCache = new Map<string, Promise<opentype.Font>>();
const loadFont = (definition: FontDefinition): Promise<opentype.Font> => {
  const localSignature =
    definition.source === 'local' ? `\u0000${definition.dataRevision ?? ''}` : '';
  const cacheKey = `${definition.id}\u0000${definition.file}${localSignature}`;
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;
  const request = (
    definition.data
      ? Promise.resolve(definition.data.slice(0))
      : fetch(definition.file).then((response) => {
          if (!response.ok) throw new Error(`Could not load the ${definition.name} font.`);
          return response.arrayBuffer();
        })
  )
    .then(parseFont)
    .catch((error) => {
      fontCache.delete(cacheKey);
      throw error;
    });
  fontCache.set(cacheKey, request);
  return request;
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
    ...(geometry.subtitle ? [geometry.subtitle] : []),
    ...geometry.recesses.map((item) => item.section),
    ...geometry.rearRecesses.map((item) => item.section),
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
    constraints: geometryConstraintsFor(params),
    printProfile: printProfileFor(geometryConstraintsFor(params)),
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
  fontOverride?: FontDefinition,
  subtitleFontOverride?: FontDefinition,
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
  if (input.templateId === 'magnet' && input.baseThicknessMm < 4.4)
    issues.push({
      severity: 'warning',
      code: 'magnet-base-adjusted',
      message:
        'Base thickness was adjusted to 4.4 mm so the 3.2 mm rear magnet pocket retains a 1.2 mm roof.',
    });
  if (!params.text)
    return invalidResult(issues, 'empty-text', 'Enter a name to create your keychain.');
  if ([...params.text].length > 24)
    return invalidResult(issues, 'text-too-long', 'Shorten the name to 24 characters or fewer.');
  const definition = fontOverride ?? fontDefinition(params.fontId);
  const subtitleDefinition =
    subtitleFontOverride ?? fontDefinition(params.subtitleFontId ?? params.fontId);
  if (
    params.templateId === 'articulated-name' &&
    !fontSupportsArticulatedName(definition, params.text)
  )
    return invalidResult(
      issues,
      'articulated-font',
      `${definition.name} is not available for articulated letters. Choose a supported heavy font.`,
    );
  let font: opentype.Font;
  try {
    font = await loadFont(definition);
  } catch {
    return invalidResult(issues, 'font-load', `Could not load the ${definition.name} font.`);
  }
  let subtitleFont: opentype.Font | undefined;
  if (params.subtitle && params.templateId !== 'articulated-name') {
    try {
      subtitleFont =
        subtitleDefinition.id === definition.id && subtitleDefinition.file === definition.file
          ? font
          : await loadFont(subtitleDefinition);
    } catch {
      return invalidResult(
        issues,
        'subtitle-font-load',
        `Could not load the ${subtitleDefinition.name} font.`,
      );
    }
  }
  const missing = hasRequiredGlyphs(font, params.text);
  if (missing)
    return invalidResult(
      issues,
      'missing-glyph',
      `The ${definition.name} font does not contain “${missing}”.`,
    );
  if (params.templateId === 'magnet' && [...params.subtitle].length > MAGNET_SUBTITLE_MAX_LENGTH)
    return invalidResult(
      issues,
      'subtitle-too-long',
      'Shorten the subtitle to 24 characters or fewer.',
    );
  if (subtitleFont && hasRequiredGlyphs(subtitleFont, params.subtitle))
    return invalidResult(
      issues,
      'subtitle-missing-glyph',
      `The ${subtitleDefinition.name} font does not contain all subtitle characters.`,
    );
  const textLayout =
    params.templateId === 'articulated-name'
      ? layoutText(font, params.text, params.textSizeMm, 0, true)
      : {
          outline: flattenText(font, params.text, params.textSizeMm, params.letterSpacingMm),
          glyphs: [],
          advances: [],
          kerning: [],
        };
  const outline = textLayout.outline;
  if (!outline.polygons.length || outline.width <= 0 || outline.height <= 0)
    return invalidResult(issues, 'empty-outline', 'This name does not produce a usable outline.');
  const articulatedGlyphs =
    params.templateId === 'articulated-name' ? textLayout.glyphs : undefined;
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
  const effectiveWeightMm = effectiveFontWeightMm(definition, params.text, params.fontWeightMm);
  const minimumFittedTextHeightMm = definition.minimumFittedTextHeightMm;
  const buildStyledGeometry = (scale: number): StyledGeometry => {
    const rawText = wasm.CrossSection.ofPolygons(scalePolygons(outline.polygons, scale), 'EvenOdd');
    let text =
      params.templateId === 'articulated-name' || effectiveWeightMm <= 0
        ? rawText.translate([0, 0])
        : rawText.offset(effectiveWeightMm * MANIFOLD_SCALE, 'Round', 2, 64);
    rawText.delete();
    const rawBounds = text.bounds();
    const textBounds = {
      min: [rawBounds.min[0], rawBounds.min[1]] as [number, number],
      max: [rawBounds.max[0], rawBounds.max[1]] as [number, number],
    };
    let subtitle: CrossSection | undefined;
    if (subtitleFont && params.subtitle) {
      const subtitleOutline = flattenText(
        subtitleFont,
        params.subtitle,
        params.subtitleTextSizeMm ?? Math.max(4, params.textSizeMm * 0.32),
        params.subtitleLetterSpacingMm ?? 0,
      );
      if (subtitleOutline.polygons.length) {
        subtitle = wasm.CrossSection.ofPolygons(
          scalePolygons(subtitleOutline.polygons, scale),
          'EvenOdd',
        );
        const subtitleWeight = params.subtitleFontWeightMm ?? 0;
        if (subtitleWeight > 0) {
          const weighted = subtitle.offset(subtitleWeight * MANIFOLD_SCALE, 'Round', 2, 64);
          subtitle.delete();
          subtitle = weighted;
        }
        const subtitleBounds = subtitle.bounds();
        const primaryHeight = Math.max(1, rawBounds.max[1] - rawBounds.min[1]);
        const subtitleHeight = subtitleBounds.max[1] - subtitleBounds.min[1];
        const subtitleSizeRatio = Math.min(1, subtitleHeight / primaryHeight);
        const requestedSubtitleGapMm = params.subtitleGapMm ?? 1.5;
        const joinBiasMm =
          params.styleId === 'contour' || params.styleId === 'arch' ? subtitleSizeRatio * 1.65 : 0;
        const effectiveSubtitleGapMm = Math.max(-0.15, requestedSubtitleGapMm - joinBiasMm);
        const positionedSubtitle = subtitle.translate([
          (rawBounds.min[0] + rawBounds.max[0] - subtitleBounds.max[0] - subtitleBounds.min[0]) /
            2 +
            (params.subtitleOffsetXRatio ?? 0) * (rawBounds.max[0] - rawBounds.min[0]),
          rawBounds.min[1] -
            subtitleBounds.max[1] -
            effectiveSubtitleGapMm * MANIFOLD_SCALE +
            (params.subtitleOffsetYRatio ?? 0) * (rawBounds.max[1] - rawBounds.min[1]),
        ]);
        subtitle.delete();
        subtitle = positionedSubtitle;
      }
    }
    let layoutBounds = subtitle
      ? {
          min: [
            Math.min(rawBounds.min[0], subtitle.bounds().min[0]),
            Math.min(rawBounds.min[1], subtitle.bounds().min[1]),
          ] as [number, number],
          max: [
            Math.max(rawBounds.max[0], subtitle.bounds().max[0]),
            Math.max(rawBounds.max[1], subtitle.bounds().max[1]),
          ] as [number, number],
        }
      : textBounds;
    if (subtitle) {
      const centerX = (layoutBounds.min[0] + layoutBounds.max[0]) / 2;
      const centerY = (layoutBounds.min[1] + layoutBounds.max[1]) / 2;
      const shift: [number, number] = [-centerX, -centerY];
      const centeredText = text.translate(shift);
      text.delete();
      text = centeredText;
      const centeredSubtitle = subtitle.translate(shift);
      subtitle.delete();
      subtitle = centeredSubtitle;
      const centeredTextBounds = text.bounds();
      const centeredSubtitleBounds = subtitle.bounds();
      layoutBounds = {
        min: [
          Math.min(centeredTextBounds.min[0], centeredSubtitleBounds.min[0]),
          Math.min(centeredTextBounds.min[1], centeredSubtitleBounds.min[1]),
        ],
        max: [
          Math.max(centeredTextBounds.max[0], centeredSubtitleBounds.max[0]),
          Math.max(centeredTextBounds.max[1], centeredSubtitleBounds.max[1]),
        ],
      };
    }
    if (subtitle && params.styleId === 'arch') {
      const archedSubtitle = archWarp(subtitle, layoutBounds, params.archCurveMm);
      subtitle.delete();
      subtitle = archedSubtitle;
    }
    const style: TemplateBuild = buildTemplate(wasm, params.templateId, params.styleId, {
      text,
      textBounds: layoutBounds,
      padding: params.paddingMm * MANIFOLD_SCALE,
      textInset:
        params.templateId === 'articulated-name' ? undefined : params.edgeInsetMm * MANIFOLD_SCALE,
      letterSpacing: params.templateId === 'articulated-name' ? 0 : params.letterSpacingMm,
      holeDiameter: params.holeDiameterMm * MANIFOLD_SCALE,
      keyringWall: keyring.wallMm * MANIFOLD_SCALE,
      templateId: params.templateId,
      connectorWidth: params.connectorWidthMm,
      cornerRadius: params.cornerRadiusMm * MANIFOLD_SCALE,
      stakeLength: params.stakeLengthMm,
      plantAccentEnabled: params.plantAccentEnabled,
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
      reliefHaloMm: params.reliefHaloMm,
      ringOffsetMm: params.ringOffsetMm,
      bubbleLobeMm: params.bubbleLobeMm,
      tagTailMm: params.tagTailMm,
      archCurveMm: params.archCurveMm,
      stakeShoulderMm: params.stakeShoulderMm,
      jointBossMm: params.jointBossMm,
      ribbonTailMm: params.ribbonTailMm,
      ribbonNotchMm: params.ribbonNotchMm,
      magnetPocketPreset: params.magnetPocketPreset,
      magnetPocketPlacement: params.magnetPocketPlacement,
      subtitle,
      constraints: geometryConstraintsFor(params),
      printProfile: printProfileFor(geometryConstraintsFor(params)),
    });
    if (isArticulatedBuild(style))
      return { kind: 'articulated', scale, rawText: text, build: style, widthMm: style.widthMm };
    const bounds = style.backing.bounds();
    return {
      kind: 'standard',
      scale,
      rawText: text,
      relief: style.relief,
      subtitle: style.subtitle,
      backing: style.backing,
      recesses: style.recesses ?? [],
      rearRecesses: style.rearRecesses ?? [],
      magnetPocket: style.magnetPocket,
      reliefDepthMm: style.reliefDepthMm,
      widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE,
    };
  };
  let styled = buildStyledGeometry(1);
  if (styled.widthMm > MAX_WIDTH_MM && minimumFittedTextHeightMm !== undefined) {
    issues.push({
      severity: 'warning',
      code: 'text-over-width',
      message: `The name remains ${params.textSizeMm.toFixed(1)} mm high and is ${styled.widthMm.toFixed(1)} mm wide; the 120 mm recommended width was not enforced for this font.`,
    });
  } else if (styled.widthMm > MAX_WIDTH_MM) {
    let highWidth = styled.widthMm;
    const minimumScale = MIN_TEXT_HEIGHT_MM / params.textSizeMm;
    if (minimumScale >= 1) {
      issues.push({
        severity: 'warning',
        code: 'text-over-width',
        message:
          'This name is wider than the recommended 120 mm at the minimum 12 mm text height; export remains available.',
      });
      // Keep the requested size. Width is a recommendation, not a geometry blocker.
    } else {
      const minimum = buildStyledGeometry(minimumScale);
      if (minimum.widthMm > MAX_WIDTH_MM) {
        releaseStyledGeometry(minimum);
        issues.push({
          severity: 'warning',
          code: 'text-over-width',
          message: `This name is ${styled.widthMm.toFixed(1)} mm wide even at the minimum 12 mm text height; export remains available.`,
        });
      } else {
        releaseStyledGeometry(styled);
        styled = minimum;
        let lowWidth = minimum.widthMm;
        let high = 1;
        for (let iteration = 0; iteration < WIDTH_FIT_ITERATIONS; iteration += 1) {
          const interpolated =
            minimumScale +
            ((high - minimumScale) * (MAX_WIDTH_MM - lowWidth)) /
              Math.max(highWidth - lowWidth, 0.001);
          const candidateScale = Math.max(
            minimumScale + (high - minimumScale) * 0.1,
            Math.min(high - (high - minimumScale) * 0.1, interpolated),
          );
          const candidate = buildStyledGeometry(candidateScale);
          if (candidate.widthMm <= MAX_WIDTH_MM) {
            releaseStyledGeometry(styled);
            styled = candidate;
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
          message: `The name was adjusted to ${(params.textSizeMm * styled.scale).toFixed(1)} mm high to keep the finished keychain within 120 mm.`,
        });
      }
    }
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
  if (params.templateId === 'magnet' && styled.magnetPocket?.adjusted)
    issues.push({
      severity: 'warning',
      code: 'magnet-pocket-adjusted',
      message:
        'The requested magnet pocket position was adjusted to preserve the surrounding wall.',
    });
  if (params.templateId === 'magnet' && styled.magnetPocket?.safe === false)
    issues.push({
      severity: 'error',
      code: 'magnet-pocket-unsafe',
      message: 'No safe position was found for the requested magnet pocket and backing.',
    });
  const textSection = styled.relief;
  const subtitleSection = styled.subtitle;
  const styleBase = styled.backing;
  const uncoveredRelief = textSection.subtract(styleBase);
  const uncoveredSubtitle = subtitleSection?.subtract(styleBase);
  const reliefContained =
    sectionArea(uncoveredRelief) <= 1 &&
    (!uncoveredSubtitle || sectionArea(uncoveredSubtitle) <= 1);
  uncoveredRelief.delete();
  uncoveredSubtitle?.delete();
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
  const rearRecesses = styled.rearRecesses ?? [];
  for (const item of rearRecesses) {
    const depth = Math.min(baseThickness - 600, Math.round(item.depthMm * MANIFOLD_SCALE));
    if (depth <= 0) continue;
    const cutSolid = item.section.extrude(depth);
    const nextBase = base.subtract(cutSolid);
    base.delete();
    cutSolid.delete();
    base = nextBase;
  }
  const effectiveReliefDepthMm = styled.reliefDepthMm ?? params.reliefDepthMm;
  const relief = textSection
    .extrude(Math.round((effectiveReliefDepthMm + 0.15) * MANIFOLD_SCALE))
    .translate([0, 0, baseThickness - Math.max(recessDepth, 0) - 150]);
  const subtitleRelief = subtitleSection
    ? subtitleSection
        .extrude(
          Math.round((params.subtitleReliefDepthMm ?? effectiveReliefDepthMm) * MANIFOLD_SCALE),
        )
        .translate([0, 0, baseThickness - 150])
    : undefined;
  const reliefCombined = subtitleRelief ? relief.add(subtitleRelief) : relief;
  const model = base.add(reliefCombined);
  const bounds = model.boundingBox();
  const baseMesh = asMesh(base);
  const reliefMesh = asMesh(reliefCombined);
  const exportMesh = includeExport ? asMesh(model) : undefined;
  const components = model.decompose();
  const connected = components.length === 1;
  deleteAll(components);
  const printable =
    model.status() === 'NoError' &&
    styled.magnetPocket?.safe !== false &&
    reliefContained &&
    finiteBounds(bounds) &&
    validateMesh(baseMesh) &&
    validateMesh(reliefMesh);
  if (!connected)
    issues.push({
      severity: 'warning',
      code: 'disconnected',
      message:
        'The selected style keeps some letters as separate printable parts; no automatic connections were added.',
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
    constraints: geometryConstraintsFor(params),
    printProfile: printProfileFor(geometryConstraintsFor(params)),
    magnetPocket: styled.magnetPocket,
    baseShading: params.templateId === 'plant-label' ? 'flat' : 'creased',
    solidCount: 1,
  };
  deleteAll([
    model,
    reliefCombined,
    ...(subtitleRelief ? [relief] : []),
    base,
    styleBase,
    ...new Set([styled.rawText, textSection]),
    ...(subtitleSection ? [subtitleSection] : []),
    ...(subtitleRelief ? [subtitleRelief] : []),
    ...styled.recesses.map((item) => item.section),
    ...rearRecesses.map((item) => item.section),
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
      constraints: DEFAULT_GEOMETRY_CONSTRAINTS,
      printProfile: DEFAULT_PRINT_PROFILE,
      solidCount: 0,
    },
  };
};
