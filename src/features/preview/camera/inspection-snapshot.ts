import type * as THREE from 'three';

import type { InspectionPan } from './inspection';
import type { ViewId } from './views';

import { MAX_INSPECTION_ZOOM, MIN_INSPECTION_ZOOM } from './inspection';
import { MIN_CAMERA_NEAR } from './views';

export type InspectionSnapshot = {
  direction: THREE.Vector3;
  up: THREE.Vector3;
  zoom: number;
  pan: InspectionPan;
  view: ViewId | 'custom';
};

const finiteVector = (vector: THREE.Vector3): boolean => vector.toArray().every(Number.isFinite);

export const validInspectionCamera = (
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
): boolean => {
  const direction = camera.position.clone().sub(target);

  return (
    finiteVector(camera.position) &&
    finiteVector(target) &&
    finiteVector(camera.up) &&
    direction.length() > MIN_CAMERA_NEAR &&
    camera.up.lengthSq() > 0 &&
    direction.normalize().cross(camera.up.clone().normalize()).lengthSq() > 1e-8 &&
    [camera.near, camera.far, camera.aspect, camera.zoom, camera.fov].every(Number.isFinite) &&
    camera.near > 0 &&
    camera.far > camera.near &&
    camera.aspect > 0 &&
    camera.zoom >= MIN_INSPECTION_ZOOM &&
    camera.zoom <= MAX_INSPECTION_ZOOM &&
    camera.fov > 0 &&
    camera.fov < 180
  );
};

/** Unfitted renderer cleanup must never become a restorable inspection pose. */
export const inspectionSnapshot = (
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  pan: InspectionPan,
  view: InspectionSnapshot['view'],
  modelInstalled: boolean,
): InspectionSnapshot | undefined => {
  if (
    !modelInstalled ||
    !validInspectionCamera(camera, target) ||
    ![pan.x, pan.y].every(Number.isFinite) ||
    Math.abs(pan.x) > 1 ||
    Math.abs(pan.y) > 1
  )
    return undefined;

  return {
    direction: camera.position.clone().sub(target).normalize(),
    up: camera.up.clone().normalize(),
    zoom: camera.zoom,
    pan: { ...pan },
    view,
  };
};
