import * as THREE from 'three';
export type ViewId = 'home' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type CameraViewIconId =
  'cube' | 'into-plane' | 'out-of-plane' | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-down';
export type ViewDefinition = {
  id: ViewId;
  label: string;
  icon: CameraViewIconId;
  direction: THREE.Vector3;
  up: THREE.Vector3;
};
export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  near: number;
  far: number;
};
const ORBIT_MARGIN = 1.08;
const SURFACE_DEPTH_CLEARANCE = 1300;
export const MIN_CAMERA_DISTANCE_SCALE = 0.22;
export const MIN_CAMERA_NEAR = 0.01;
const MAX_CAMERA_DISTANCE_SCALE = 64;
export const VIEW_DEFINITIONS: readonly ViewDefinition[] = [
  {
    id: 'home',
    label: 'Home view',
    icon: 'cube',
    direction: new THREE.Vector3(0, -0.9, 0.95).normalize(),
    up: new THREE.Vector3(0, 1, 0),
  },
  {
    id: 'front',
    label: 'Front view',
    icon: 'out-of-plane',
    direction: new THREE.Vector3(0, -1, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: 'back',
    label: 'Back view',
    icon: 'into-plane',
    direction: new THREE.Vector3(0, 1, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: 'left',
    label: 'Left view',
    icon: 'arrow-left',
    direction: new THREE.Vector3(-1, 0, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: 'right',
    label: 'Right view',
    icon: 'arrow-right',
    direction: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 0, 1),
  },
  {
    id: 'top',
    label: 'Top view',
    icon: 'arrow-up',
    direction: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
  },
  {
    id: 'bottom',
    label: 'Bottom view',
    icon: 'arrow-down',
    direction: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, -1, 0),
  },
];
export const viewDefinition = (id: ViewId): ViewDefinition => {
  return VIEW_DEFINITIONS.find((view) => view.id === id) ?? VIEW_DEFINITIONS[0];
};
const boxCorners = (bounds: THREE.Box3): THREE.Vector3[] => {
  const { min, max } = bounds;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
};
export const modelBounds = (
  width: number,
  height: number,
  depth: number,
  center: THREE.Vector3,
): THREE.Box3 => {
  const halfSize = new THREE.Vector3(width / 2, height / 2, depth / 2);
  return new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize));
};
export const cameraPose = (
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  direction: THREE.Vector3,
  preferredUp: THREE.Vector3,
  distanceScale = 1,
): CameraPose => {
  const target = bounds.getCenter(new THREE.Vector3());
  const outward = direction.clone().normalize();
  const up = preferredUp.clone().addScaledVector(outward, -preferredUp.dot(outward));
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0).addScaledVector(outward, -outward.y);
  up.normalize();
  const right = up.clone().cross(outward).normalize();
  const relativeCorners = boxCorners(bounds).map((corner) => corner.sub(target));
  const projectedHalfWidth = Math.max(
    ...relativeCorners.map((corner) => Math.abs(corner.dot(right))),
  );
  const projectedHalfHeight = Math.max(
    ...relativeCorners.map((corner) => Math.abs(corner.dot(up))),
  );
  const projectedHalfDepth = Math.max(
    ...relativeCorners.map((corner) => Math.abs(corner.dot(outward))),
  );
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const framingMargin = 1.12;
  const planarDistance = Math.max(
    (projectedHalfWidth * framingMargin) / Math.tan(horizontalFov / 2),
    (projectedHalfHeight * framingMargin) / Math.tan(verticalFov / 2),
  );
  const size = bounds.getSize(new THREE.Vector3());
  const radius = size.length() / 2;
  const clearance = Math.max(1, Math.max(size.x, size.y, size.z) * 0.02);
  const narrowFov = Math.min(verticalFov, horizontalFov);
  const orbitDistance = (radius * ORBIT_MARGIN) / Math.sin(narrowFov / 2);
  const distance =
    Math.max(planarDistance + projectedHalfDepth + clearance, orbitDistance) *
    Math.max(MIN_CAMERA_DISTANCE_SCALE, distanceScale);
  const position = target.clone().addScaledVector(outward, distance);
  const near = Math.max(MIN_CAMERA_NEAR, distance - radius - clearance);
  const far = Math.max(near + 1, distance + radius + clearance + SURFACE_DEPTH_CLEARANCE);
  return { position, target, up, near, far };
};

/** Return whether a pose keeps every model corner inside the perspective frustum. */
export const poseContainsBounds = (
  camera: THREE.PerspectiveCamera,
  pose: CameraPose,
  bounds: THREE.Box3,
  margin = 0.96,
): boolean => {
  const outward = pose.target.clone().sub(pose.position).normalize();
  const up = pose.up.clone().normalize();
  const right = up.clone().cross(outward).normalize();
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const tanVertical = Math.tan(verticalFov / 2) * margin;
  const tanHorizontal = Math.tan(horizontalFov / 2) * margin;

  return boxCorners(bounds).every((corner) => {
    const offset = corner.sub(pose.position);
    const depth = offset.dot(outward);
    if (depth <= pose.near || depth >= pose.far) return false;
    return (
      Math.abs(offset.dot(right)) <= depth * tanHorizontal &&
      Math.abs(offset.dot(up)) <= depth * tanVertical
    );
  });
};

/** Find the closest scale that still frames the complete model for a given angle. */
export const fittedCameraPose = (
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  direction: THREE.Vector3,
  preferredUp: THREE.Vector3,
  requestedScale = 1,
): { pose: CameraPose; scale: number } => {
  let scale = Math.max(MIN_CAMERA_DISTANCE_SCALE, requestedScale);
  let pose = cameraPose(camera, bounds, direction, preferredUp, scale);
  if (poseContainsBounds(camera, pose, bounds)) return { pose, scale };

  let low = scale;
  let high = Math.max(1, scale);
  let highPose = cameraPose(camera, bounds, direction, preferredUp, high);
  while (!poseContainsBounds(camera, highPose, bounds) && high < MAX_CAMERA_DISTANCE_SCALE) {
    low = high;
    high = Math.min(MAX_CAMERA_DISTANCE_SCALE, high * 2);
    highPose = cameraPose(camera, bounds, direction, preferredUp, high);
  }
  if (!poseContainsBounds(camera, highPose, bounds)) return { pose: highPose, scale: high };

  for (let iteration = 0; iteration < 14; iteration += 1) {
    const midpoint = (low + high) / 2;
    const candidate = cameraPose(camera, bounds, direction, preferredUp, midpoint);
    if (poseContainsBounds(camera, candidate, bounds)) {
      high = midpoint;
    } else {
      low = midpoint;
    }
  }
  scale = high;
  pose = cameraPose(camera, bounds, direction, preferredUp, scale);
  return { pose, scale };
};
export const applyCameraPose = (camera: THREE.PerspectiveCamera, pose: CameraPose): void => {
  camera.position.copy(pose.position);
  camera.up.copy(pose.up);
  camera.near = pose.near;
  camera.far = pose.far;
  camera.lookAt(pose.target);
  camera.updateProjectionMatrix();
};
