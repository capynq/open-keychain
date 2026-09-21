import { CatmullRomCurve3, ExtrudeGeometry, Path, Shape, Vector3 } from 'three';

import type {
  DisposableGeometry,
  GeometryWasm,
  Manifold,
} from '../../../infrastructure/geometry/manifold-types';
import type { GeometryResult, KeychainParams, MeshBuffer } from '../model/types';

import {
  asMesh,
  finiteBounds,
  manifoldFromMesh,
  MANIFOLD_SCALE,
  partitionMaterialSolids,
  validateMesh,
} from '../../../infrastructure/geometry/manifold-utils';
import { validateModelFeatures, type ModelFeature } from '../model/model-feature';

/** Ordered constructive features; nodes remain editable, deterministic data. */
export const applyFeatureGraph = (
  wasm: GeometryWasm,
  original: GeometryResult,
  params: KeychainParams,
  includeExport: boolean,
): { result: GeometryResult; exportMesh?: MeshBuffer } => {
  const features = params.modelFeatures ?? [];
  if (!validateModelFeatures(features)) throw new Error('Invalid or oversized design features.');
  const started = performance.now();
  // These templates contain assemblies, carriers, or hardware clearances that this
  // generic boolean graph cannot preserve. Keeping the source result intact is safer
  // than silently dropping those template-specific solids.
  if (params.templateId === 'articulated-name' || params.templateId === 'nameplate') {
    return {
      result: {
        ...original,
        issues: [
          ...original.issues,
          {
            severity: 'error',
            code: 'feature-unsupported-template',
            message: 'Custom model features are not supported for this template.',
          },
        ],
        printable: false,
        timings: { ...original.timings, featuresMs: performance.now() - started },
      },
    };
  }
  const owned = new Set<DisposableGeometry>();
  const own = <T extends DisposableGeometry>(value: T): T => {
    owned.add(value);
    return value;
  };
  const fromMesh = (mesh: MeshBuffer): Manifold => {
    return own(manifoldFromMesh(wasm, mesh));
  };
  const shapeFor = (feature: ModelFeature): Manifold => {
    const [x, y, z] = feature.sizeMm.map((size) => size * MANIFOLD_SCALE);
    let source: Manifold;
    if (feature.kind === 'box') source = own(wasm.Manifold.cube([x, y, z], true));
    else if (feature.kind === 'sphere')
      source = own(own(wasm.Manifold.sphere(x / 2, 64)).scale([1, y / x, z / x]));
    else if (feature.kind === 'cylinder')
      source = own(own(wasm.Manifold.cylinder(z, x / 2, x / 2, 64, true)).scale([1, y / x, 1]));
    else {
      const polygons = feature.polygons!.map((polygon) =>
        polygon.map(([px, py]) => [px * MANIFOLD_SCALE, py * MANIFOLD_SCALE] as [number, number]),
      );
      const section = own(new wasm.CrossSection(polygons, 'NonZero'));
      if (feature.kind === 'extrude') source = own(section.extrude(z));
      else if (feature.kind === 'revolve') {
        if (feature.polygons!.some((polygon) => polygon.some(([px]) => px < 0)))
          throw new Error('A revolution profile must stay on the positive side of its axis.');
        source = own(section.revolve(96));
      } else {
        const components = section.decompose().map(own);
        const shapes = components.map((component) => {
          const contours = component.toPolygons();
          const paths = contours.map((contour) => {
            const path = new Path();
            contour.forEach(([px, py], index) =>
              index ? path.lineTo(px, py) : path.moveTo(px, py),
            );
            path.closePath();
            return path;
          });
          const shape = new Shape();
          shape.curves = paths[0].curves;
          shape.holes = paths.slice(1);
          return shape;
        });
        const curve = new CatmullRomCurve3(
          feature.pathMm!.map(
            ([px, py, pz]) =>
              new Vector3(px * MANIFOLD_SCALE, py * MANIFOLD_SCALE, pz * MANIFOLD_SCALE),
          ),
          false,
          'centripetal',
        );
        const geometry = new ExtrudeGeometry(shapes, {
          bevelEnabled: false,
          curveSegments: 1,
          steps: Math.min(256, Math.max(16, feature.pathMm!.length * 16)),
          extrudePath: curve,
        });
        try {
          const vertices = geometry.getAttribute('position');
          const mesh = new wasm.Mesh({
            numProp: 3,
            vertProperties: new Float32Array(vertices.array),
            triVerts: Uint32Array.from({ length: vertices.count }, (_, index) => index),
          });
          mesh.merge();
          source = own(new wasm.Manifold(mesh));
        } finally {
          geometry.dispose();
        }
      }
    }
    if (source.status() !== 'NoError' || source.isEmpty())
      throw new Error(`Feature ${feature.id} does not form a valid solid.`);
    const transformed = own(source.rotate(feature.rotationDeg));
    const positioned = own(
      transformed.translate(
        feature.positionMm.map((value) => value * MANIFOLD_SCALE) as [number, number, number],
      ),
    );
    if (
      !finiteBounds(positioned.boundingBox()) ||
      positioned.status() !== 'NoError' ||
      positioned.numTri() === 0
    )
      throw new Error(`Feature ${feature.id} does not form a valid bounded solid.`);
    return positioned;
  };
  try {
    let base = fromMesh(original.baseMesh);
    let relief = fromMesh(original.reliefMesh);
    for (const feature of features) {
      const tool = shapeFor(feature);
      if (feature.operation === 'add') base = own(base.add(tool));
      else if (feature.operation === 'subtract') {
        base = own(base.subtract(tool));
        relief = own(relief.subtract(tool));
      } else {
        base = own(base.intersect(tool));
        relief = own(relief.intersect(tool));
      }
    }
    const model = own(base.add(relief));
    const partition = partitionMaterialSolids(base, relief, model);
    base = own(partition.base);
    let outputModel = model;
    const initialBounds = outputModel.boundingBox();
    if (finiteBounds(initialBounds) && initialBounds.min[2] !== 0) {
      const offset: [number, number, number] = [0, 0, -initialBounds.min[2]];
      const translatedBase = own(base.translate(offset));
      relief = own(relief.translate(offset));
      const translatedModel = own(outputModel.translate(offset));
      base = translatedBase;
      outputModel = translatedModel;
    }
    const bounds = outputModel.boundingBox();
    const components = outputModel.decompose().map(own);
    const baseMesh = asMesh(base);
    const reliefMesh = asMesh(relief);
    // Only connectivity is recalculated by this graph. Existing blocking issues are
    // intentionally retained because a boolean cannot prove them resolved.
    const issues = original.issues.filter((issue) => issue.code !== 'disconnected');
    issues.push({
      severity: 'warning',
      code: 'feature-manufacturing-unverified',
      message:
        'Custom geometry has not been checked for minimum walls, hardware fit, or support-free printing. Review it in a slicer before printing.',
    });
    if (components.length > 1)
      issues.push({
        severity: params.styleId === 'heart-split' ? 'warning' : 'error',
        code: 'disconnected',
        message:
          params.styleId === 'heart-split'
            ? 'Heart Split is a multi-part assembly. Keep its parts together in the selected print job.'
            : 'The design contains disconnected solids. Confirm separate-solid export below to continue.',
      });
    const bounded = finiteBounds(bounds);
    if (
      outputModel.status() !== 'NoError' ||
      outputModel.isEmpty() ||
      !bounded ||
      !validateMesh(baseMesh) ||
      !validateMesh(reliefMesh)
    )
      issues.push({
        severity: 'error',
        code: 'feature-geometry',
        message: 'The design features do not form a non-empty valid solid.',
      });
    const dimensions = {
      widthMm: bounded
        ? (bounds.max[0] - bounds.min[0]) / MANIFOLD_SCALE
        : original.dimensions.widthMm,
      heightMm: bounded
        ? (bounds.max[1] - bounds.min[1]) / MANIFOLD_SCALE
        : original.dimensions.heightMm,
      thicknessMm: bounded
        ? (bounds.max[2] - bounds.min[2]) / MANIFOLD_SCALE
        : original.dimensions.thicknessMm,
      centerMm: bounded
        ? (bounds.min.map((value, index) => (value + bounds.max[index]) / (2 * MANIFOLD_SCALE)) as [
            number,
            number,
            number,
          ])
        : original.dimensions.centerMm,
    };
    if (dimensions.widthMm > 120)
      issues.push({
        severity: 'warning',
        code: 'text-over-width',
        message: 'The finished design exceeds the recommended 120 mm width.',
      });
    const result: GeometryResult = {
      ...original,
      baseMesh,
      reliefMesh,
      edgeFinish: original.edgeFinish
        ? { ...original.edgeFinish, quality: 'unverified' }
        : undefined,
      dimensions,
      issues,
      printable: !issues.some((issue) => issue.severity === 'error'),
      solidCount: components.length,
      timings: { ...original.timings, featuresMs: performance.now() - started },
    };
    return {
      result,
      ...(includeExport && result.printable ? { exportMesh: asMesh(outputModel) } : {}),
    };
  } finally {
    for (const object of owned) object.delete();
  }
};
