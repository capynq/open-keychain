import type { Manifold } from '../../../infrastructure/geometry/manifold-types';
import { MANIFOLD_SCALE, asMesh, validateMesh } from '../../../infrastructure/geometry/manifold-utils';
import type { ArticulatedBuild } from '../templates/template-builder';
import type { KeychainParams, ValidationIssue } from '../model/types';

const hasSolidIntersection = (left: Manifold, right: Manifold): boolean => {
  const intersection = left.intersect(right);
  const collision = intersection.numTri() > 0;
  intersection.delete();
  return collision;
};

const motionEnvelopeValid = (build: ArticulatedBuild, maxAngleDeg: number): boolean => {
  const angles = [-maxAngleDeg, -maxAngleDeg / 2, 0, maxAngleDeg / 2, maxAngleDeg];
  return angles.every((angle) => {
    const excursion = Math.abs(Math.sin((angle * Math.PI) / 180)) * build.invariants.neckWidth * 0.25;
    return (
      build.invariants.chamberDiameter >= build.invariants.headDiameter + build.invariants.clearance * 2 + excursion * 2
    );
  });
};

export const validateArticulatedBuild = (
  build: ArticulatedBuild,
  params: KeychainParams,
  issues: ValidationIssue[],
): boolean => {
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
    components.forEach((component) => component.delete());
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
};
