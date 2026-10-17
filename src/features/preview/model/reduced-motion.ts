import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Disable OrbitControls damping without allowing pending inertia to move the
 * camera. The public controls API is sufficient; no internal spherical state
 * is read or mutated.
 */
export const setOrbitControlsDamping = (controls: OrbitControls, enabled: boolean): void => {
  if (controls.enableDamping === enabled) return;

  if (enabled) {
    controls.enableDamping = true;
    return;
  }

  const cameraPosition = controls.object.position.clone();
  const cameraQuaternion = controls.object.quaternion.clone();
  const cameraZoom = 'zoom' in controls.object ? controls.object.zoom : undefined;
  const target = controls.target.clone();

  controls.enableDamping = false;
  controls.update();

  controls.object.position.copy(cameraPosition);
  controls.object.quaternion.copy(cameraQuaternion);
  if (cameraZoom !== undefined && 'zoom' in controls.object) controls.object.zoom = cameraZoom;
  controls.target.copy(target);
  controls.update();

  // OrbitControls.update() derives orientation from the target. Restore the
  // exact captured orientation as well so a transition cannot alter the pose.
  controls.object.quaternion.copy(cameraQuaternion);
};
