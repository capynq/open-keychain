import * as THREE from 'three';

export const MIN_INSPECTION_ZOOM = 0.25;
export const MAX_INSPECTION_ZOOM = 4;
export const INSPECTION_ZOOM_STEP = 1.25;

export type InspectionPan = { x: number; y: number };

export const clampInspectionZoom = (zoom: number): number =>
  THREE.MathUtils.clamp(zoom, MIN_INSPECTION_ZOOM, MAX_INSPECTION_ZOOM);

export const scaleInspectionZoom = (zoom: number, factor: number): number =>
  clampInspectionZoom(zoom * factor);

/** Keep the target shift inside a normalized projected model rectangle. */
export const clampInspectionPan = (pan: InspectionPan): InspectionPan => ({
  x: THREE.MathUtils.clamp(Number.isFinite(pan.x) ? pan.x : 0, -1, 1),
  y: THREE.MathUtils.clamp(Number.isFinite(pan.y) ? pan.y : 0, -1, 1),
});

export const inspectionPanFrame = (
  bounds: THREE.Box3,
  outward: THREE.Vector3,
  up: THREE.Vector3,
) => {
  const direction = outward.clone().normalize();
  const right = up.clone().cross(direction).normalize();
  const viewUp = direction.clone().cross(right).normalize();
  const center = bounds.getCenter(new THREE.Vector3());
  const corners = Array.from({ length: 8 }, (_, index) =>
    new THREE.Vector3(
      index & 1 ? bounds.max.x : bounds.min.x,
      index & 2 ? bounds.max.y : bounds.min.y,
      index & 4 ? bounds.max.z : bounds.min.z,
    ).sub(center),
  );
  return {
    right,
    up: viewUp,
    halfWidth: Math.max(...corners.map((corner) => Math.abs(corner.dot(right))), 1),
    halfHeight: Math.max(...corners.map((corner) => Math.abs(corner.dot(viewUp))), 1),
  };
};

export const panToTargetOffset = (
  pan: InspectionPan,
  bounds: THREE.Box3,
  camera: THREE.PerspectiveCamera,
  up: THREE.Vector3,
): THREE.Vector3 => {
  const frame = inspectionPanFrame(
    bounds,
    camera.getWorldDirection(new THREE.Vector3()).negate(),
    up,
  );
  return frame.right
    .multiplyScalar(pan.x * frame.halfWidth)
    .addScaledVector(frame.up, pan.y * frame.halfHeight);
};
