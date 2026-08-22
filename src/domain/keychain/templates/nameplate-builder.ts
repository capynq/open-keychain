import type { GeometryWasm, Manifold } from '../../../infrastructure/geometry/manifold-types';
import {
  MANIFOLD_SCALE,
  asMesh,
  disposeGeometry,
  finiteBounds,
  validateMesh,
} from '../../../infrastructure/geometry/manifold-utils';
import {
  DEFAULT_PRINT_APPEARANCE,
  geometryConstraintsFor,
  printProfileFor,
  type GeometryResult,
  type KeychainParams,
  type MeshBuffer,
  type ValidationIssue,
} from '../model/types';
import type { StandardStyledGeometry } from '../build/styled-types';

const deleteGeometry = disposeGeometry;

export const buildNameplate = (
  wasm: GeometryWasm,
  styled: StandardStyledGeometry,
  params: KeychainParams,
  issues: ValidationIssue[],
  includeExport: boolean,
): { result: GeometryResult; exportMesh?: MeshBuffer } => {
  const baseThickness = Math.round(params.baseThicknessMm * MANIFOLD_SCALE);
  const embedDepth = Math.min(
    Math.max(200, Math.round(params.nameplateEmbedMm * MANIFOLD_SCALE)),
    Math.max(200, baseThickness - 300),
  );
  const visibleDepth = Math.round(params.reliefDepthMm * MANIFOLD_SCALE);
  const plate = styled.backing.extrude(baseThickness);
  const textBounds = styled.relief.bounds();
  const pivotX = (textBounds.min[0] + textBounds.max[0]) / 2;
  const pivotY = textBounds.min[1];
  const plateBounds = plate.boundingBox();
  const embeddingSafety = 250 + Math.max(0, params.reliefHaloMm) * MANIFOLD_SCALE;
  const embeddingStep = 250;
  const tolerance = 250;
  const carrierDepth = embedDepth + visibleDepth + embeddingSafety;
  const carrierRawText = styled.relief.extrude(carrierDepth);
  const carrierCentered = carrierRawText.translate([-pivotX, -pivotY, 0]);
  const carrierRotated = carrierCentered.rotate([params.nameplateTiltDeg, 0, 0]);
  const carrierRotatedBounds = carrierRotated.boundingBox();
  const carrier = carrierRotated.translate([
    pivotX,
    pivotY,
    baseThickness - embedDepth - carrierRotatedBounds.max[2],
  ]);
  deleteGeometry([carrierRawText, carrierCentered, carrierRotated]);
  const carrierBounds = carrier.boundingBox();
  let tiltedText: Manifold | undefined;
  let model: Manifold | undefined;
  let textInsidePlateFootprint = false;
  let everyTextPartEmbedded = false;
  let hasVisibleCap = false;
  let connected = false;
  let carrierFullyEmbedded = false;
  const createStretchedRelief = (rootDepth: number): Manifold => {
    const depth = rootDepth + visibleDepth;
    const raw = styled.relief.extrude(depth, 12);
    const centered = raw.translate([-pivotX, -pivotY, 0]);
    const angle = (params.nameplateTiltDeg * Math.PI) / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const stretched = centered.warpBatch((vertices: Float64Array, count: number) => {
      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        const y = vertices[offset + 1];
        const z = vertices[offset + 2];
        const progress = Math.max(0, Math.min(1, z / depth));
        const tiltedY = y * cosine - z * sine;
        const tiltedZ = y * sine + z * cosine;
        vertices[offset + 1] = y + (tiltedY - y) * progress;
        vertices[offset + 2] = z + (tiltedZ - z) * progress;
      }
    });
    const placed = stretched.translate([pivotX, pivotY, baseThickness - rootDepth]);
    deleteGeometry([raw, centered, stretched]);
    return placed;
  };
  for (let attempt = 0; attempt < 13; attempt += 1) {
    const rootDepth = embedDepth + embeddingSafety + attempt * embeddingStep;
    const candidateText = createStretchedRelief(rootDepth);
    const candidateBounds = candidateText.boundingBox();
    const candidateInsidePlateFootprint = [carrierBounds, candidateBounds].every(
      (bounds) =>
        bounds.min[0] >= plateBounds.min[0] + tolerance &&
        bounds.max[0] <= plateBounds.max[0] - tolerance &&
        bounds.min[1] >= plateBounds.min[1] - tolerance &&
        bounds.max[1] <= plateBounds.max[1] + tolerance,
    );
    const candidateParts = candidateText.decompose();
    const candidateEmbedded = candidateParts.every((part) => {
      const overlap = plate.intersect(part);
      const embedded = overlap.numTri() > 0;
      overlap.delete();
      return embedded;
    });
    deleteGeometry(candidateParts);
    const candidateHasVisibleCap = candidateBounds.max[2] > baseThickness + 300;
    const candidateCarrierEmbedded = carrierBounds.max[2] <= baseThickness - 100;
    const candidateUnion = wasm.Manifold.union([plate, carrier, candidateText]);
    const candidateModel = candidateUnion.simplify(15);
    candidateUnion.delete();
    const candidateComponents = candidateModel.decompose();
    const candidateConnected = candidateComponents.length === 1;
    deleteGeometry(candidateComponents);
    if (
      candidateInsidePlateFootprint &&
      candidateEmbedded &&
      candidateCarrierEmbedded &&
      candidateHasVisibleCap &&
      candidateConnected
    ) {
      tiltedText = candidateText;
      model = candidateModel;
      textInsidePlateFootprint = candidateInsidePlateFootprint;
      everyTextPartEmbedded = candidateEmbedded;
      hasVisibleCap = candidateHasVisibleCap;
      connected = candidateConnected;
      carrierFullyEmbedded = candidateCarrierEmbedded;
      break;
    }
    if (attempt === 12) {
      tiltedText = candidateText;
      model = candidateModel;
      textInsidePlateFootprint = candidateInsidePlateFootprint;
      everyTextPartEmbedded = candidateEmbedded;
      hasVisibleCap = candidateHasVisibleCap;
      connected = candidateConnected;
      carrierFullyEmbedded = candidateCarrierEmbedded;
    } else {
      candidateText.delete();
      candidateModel.delete();
    }
  }
  if (!tiltedText || !model) throw new Error('Nameplate geometry did not produce a text carrier.');
  const bounds = model.boundingBox();
  const textSolidBounds = tiltedText.boundingBox();
  const hasEmbedding =
    carrierFullyEmbedded && textSolidBounds.min[2] < baseThickness - 100 && everyTextPartEmbedded;
  if (!textInsidePlateFootprint)
    issues.push({
      severity: 'error',
      code: 'nameplate-text-outside-plate',
      message:
        'The tilted inscription extends beyond the nameplate. Increase padding or reduce the tilt.',
    });
  if (!hasEmbedding || !hasVisibleCap)
    issues.push({
      severity: 'error',
      code: 'nameplate-embedding',
      message: 'The inscription could not be embedded while leaving a visible raised cap.',
    });
  if (!connected)
    issues.push({
      severity: 'error',
      code: 'disconnected',
      message: 'The nameplate inscription is not connected to its foundation.',
    });
  if (model.numTri() > 12000)
    issues.push({
      severity: 'warning',
      code: 'dense-mesh',
      message: 'This curved model exceeds 12,000 triangles and may take longer to slice.',
    });
  const trimmedVisibleText = tiltedText.trimByPlane([0, 0, 1], baseThickness - 100);
  const visibleText = trimmedVisibleText.simplify(20);
  trimmedVisibleText.delete();
  const baseMesh = asMesh(plate);
  const reliefMesh = asMesh(visibleText);
  const exportMesh = includeExport ? asMesh(model) : undefined;
  const printable =
    model.status() === 'NoError' &&
    connected &&
    textInsidePlateFootprint &&
    hasEmbedding &&
    hasVisibleCap &&
    finiteBounds(bounds) &&
    validateMesh(baseMesh) &&
    validateMesh(reliefMesh);
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
    solidCount: 1,
  };
  deleteGeometry([
    ...new Set([
      model,
      visibleText,
      tiltedText,
      carrier,
      plate,
      styled.backing,
      styled.relief,
      styled.rawText,
    ]),
  ]);
  return { result, exportMesh };
};
