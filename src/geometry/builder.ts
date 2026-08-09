import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import { fontDefinition } from '../fonts/catalog';
import { flattenText, hasRequiredGlyphs } from './text';
import { buildStyle } from './styles';
import { keyringMetrics, normalizeParams, type GeometryResult, type KeychainParams, type MeshBuffer, type ValidationIssue } from './types';

const MAX_WIDTH_MM = 120;
const MIN_TEXT_HEIGHT_MM = 12;
const MANIFOLD_SCALE = 1000;
const WIDTH_FIT_ITERATIONS = 6;

function parseFont(buffer: ArrayBuffer): opentype.Font {
  const module = opentype as unknown as { parse?: (data: ArrayBuffer) => opentype.Font; default?: { parse: (data: ArrayBuffer) => opentype.Font } };
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

function scalePolygons(polygons: Array<Array<[number, number]>>, factor: number): Array<Array<[number, number]>> {
  return polygons.map((polygon) => polygon.map(([x, y]) => [
    Math.round(x * factor * MANIFOLD_SCALE),
    Math.round(y * factor * MANIFOLD_SCALE),
  ]));
}

function deleteAll(items: any[]): void {
  items.forEach((item) => {
    try { item.delete(); } catch { /* already released */ }
  });
}

function validateMesh(mesh: MeshBuffer): boolean {
  return [...mesh.positions].every(Number.isFinite) && [...mesh.indices].every(Number.isFinite);
}

function finiteBounds(bounds: { min: number[]; max: number[] }): boolean {
  return [...bounds.min, ...bounds.max].every(Number.isFinite);
}

export async function createWasm(): Promise<Wasm> {
  const isBrowser = typeof (globalThis as { window?: unknown }).window !== 'undefined';
  const wasmPath = isBrowser ? '/manifold.wasm' : new URL('../../public/manifold.wasm', import.meta.url).pathname;
  const wasm = await Module({ locateFile: () => wasmPath });
  wasm.setup();
  return wasm;
}

export async function buildKeychain(wasm: Wasm, input: KeychainParams, includeExport = false): Promise<{
  result: GeometryResult;
  exportMesh?: MeshBuffer;
}> {
  const params = normalizeParams(input);
  const issues: ValidationIssue[] = [];
  if (!params.text) {
    return invalidResult(issues, 'empty-text', 'Enter a name to create your keychain.');
  }
  if ([...params.text].length > 24) {
    return invalidResult(issues, 'text-too-long', 'Shorten the name to 24 characters or fewer.');
  }

  const definition = fontDefinition(params.fontId);
  const response = await fetch(definition.file);
  if (!response.ok) return invalidResult(issues, 'font-load', `Could not load the ${definition.name} font.`);
  const buffer = await response.arrayBuffer();
  const font = parseFont(buffer);
  const missing = hasRequiredGlyphs(font, params.text);
  if (missing) return invalidResult(issues, 'missing-glyph', `The ${definition.name} font does not contain “${missing}”.`);

  const outline = flattenText(font, params.text, params.textHeightMm);
  if (!outline.polygons.length || outline.width <= 0 || outline.height <= 0) {
    return invalidResult(issues, 'empty-outline', 'This name does not produce a usable outline.');
  }

  const keyring = keyringMetrics(params.holeDiameterMm);
  type StyledGeometry = { scale: number; text: any; backing: any; recesses: Array<{ section: any; depthMm: number }>; widthMm: number };
  const buildStyledGeometry = (scale: number): StyledGeometry => {
    const text = wasm.CrossSection.ofPolygons(scalePolygons(outline.polygons, scale), 'EvenOdd');
    const rawBounds = text.bounds();
    const textBounds = {
      min: [rawBounds.min[0], rawBounds.min[1]] as [number, number],
      max: [rawBounds.max[0], rawBounds.max[1]] as [number, number],
    };
    const style = buildStyle(wasm, params.styleId, {
      text,
      textBounds,
      padding: params.paddingMm * MANIFOLD_SCALE,
      holeDiameter: params.holeDiameterMm * MANIFOLD_SCALE,
      keyringWall: keyring.wallMm * MANIFOLD_SCALE,
    });
    const bounds = style.backing.bounds();
    return { scale, text, backing: style.backing, recesses: style.recesses ?? [], widthMm: (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE };
  };
  const releaseStyledGeometry = (geometry: StyledGeometry) => deleteAll([geometry.backing, geometry.text, ...geometry.recesses.map((item) => item.section)]);

  let styled = buildStyledGeometry(1);
  if (styled.widthMm > MAX_WIDTH_MM) {
    let highWidth = styled.widthMm;
    const minimumScale = MIN_TEXT_HEIGHT_MM / params.textHeightMm;
    if (minimumScale >= 1) {
      releaseStyledGeometry(styled);
      return invalidResult(issues, 'text-too-wide', 'This name cannot fit within 120 mm at the minimum 12 mm text height. Shorten the name or choose a narrower font.');
    }
    const minimum = buildStyledGeometry(minimumScale);
    if (minimum.widthMm > MAX_WIDTH_MM) {
      releaseStyledGeometry(styled);
      releaseStyledGeometry(minimum);
      return invalidResult(issues, 'text-too-wide', 'This name cannot fit within 120 mm without making the text smaller than 12 mm. Shorten the name or choose a narrower font.');
    }
    releaseStyledGeometry(styled);
    styled = minimum;
    let low = minimumScale;
    let lowWidth = minimum.widthMm;
    let high = 1;
    for (let iteration = 0; iteration < WIDTH_FIT_ITERATIONS; iteration += 1) {
      // Keep a binary bracket, using its measured widths to choose the next
      // split. Styled width is nearly linear in text scale, so this reaches
      // the 0.1 mm target without adding more geometry builds.
      const interpolated = low + (high - low) * (MAX_WIDTH_MM - lowWidth) / Math.max(highWidth - lowWidth, 0.001);
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
    issues.push({ severity: 'warning', code: 'scaled-to-fit', message: `The name was adjusted to ${(params.textHeightMm * styled.scale).toFixed(1)} mm high to keep the finished keychain within 120 mm.` });
  }

  const textSection = styled.text;
  const styleBase = styled.backing;
  const baseThickness = Math.round(params.baseThicknessMm * MANIFOLD_SCALE);
  let base = styleBase.extrude(baseThickness);
  const maxRecessDepth = Math.max(0, baseThickness - 600);
  const recessDepth = styled.recesses.length ? Math.min(
    maxRecessDepth,
    Math.round(Math.max(...styled.recesses.map((item) => item.depthMm * MANIFOLD_SCALE))),
  ) : 0;
  if (recessDepth > 0) {
    const cuts = styled.recesses.map((item) => item.section.extrude(recessDepth).translate([0, 0, baseThickness - recessDepth]));
    // Recesses are cut from the top of the backing, leaving a connected lower panel.
    // Manifold subtraction keeps the border walls crisp without changing output meshes.
    const cutSolids = cuts;
    for (const cutSolid of cutSolids) {
      const nextBase = base.subtract(cutSolid);
      base.delete();
      cutSolid.delete();
      base = nextBase;
    }
  }
  const reliefBaseZ = baseThickness - Math.max(recessDepth, 0) - 150;
  const relief = textSection.extrude(Math.round((params.reliefDepthMm + 0.15) * MANIFOLD_SCALE))
    .translate([0, 0, reliefBaseZ]);
  const model = base.add(relief);
  const bounds = model.boundingBox();
  const baseMesh = asMesh(base);
  const reliefMesh = asMesh(relief);
  const exportMesh = includeExport ? asMesh(model) : undefined;
  const components = model.decompose();
  const connected = components.length === 1;
  deleteAll(components);
  const printable = model.status() === 'NoError' && connected && finiteBounds(bounds) && validateMesh(baseMesh) && validateMesh(reliefMesh);
  if (!connected) issues.push({ severity: 'error', code: 'disconnected', message: 'Some parts of the name are not connected. Increase padding or choose another style.' });
  if (model.numTri() > 12000) issues.push({ severity: 'warning', code: 'dense-mesh', message: 'This curved model exceeds 12,000 triangles and may take longer to slice.' });
  if (params.reliefDepthMm < 0.5) issues.push({ severity: 'warning', code: 'shallow-relief', message: 'A slightly taller text relief is easier to see after printing.' });
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
  };
  deleteAll([model, relief, base, styleBase, textSection, ...styled.recesses.map((item) => item.section)]);
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
    },
  };
}
