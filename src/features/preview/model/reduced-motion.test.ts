import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';

import { setOrbitControlsDamping } from './reduced-motion';

describe('setOrbitControlsDamping', () => {
  it('disables damping while preserving a pending orbit pose and target', () => {
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    const controls = new OrbitControls(camera);

    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.target.set(4, -3, 2);
    camera.position.set(40, -24, 31);
    camera.lookAt(controls.target);
    camera.zoom = 1.7;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    controls.update();

    // These public calls leave residual deltas when damping is enabled.
    controls.domElement = { clientHeight: 100, clientWidth: 100 } as HTMLElement;
    controls.rotateLeft(0.4);
    controls.pan(10, -5);
    const residualPosition = camera.position.clone();
    controls.update();
    expect(camera.position.distanceTo(residualPosition)).toBeGreaterThan(1e-6);
    controls.rotateLeft(0.2);
    controls.pan(-4, 3);

    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const target = controls.target.clone();
    const zoom = camera.zoom;

    setOrbitControlsDamping(controls, false);

    expect(controls.enableDamping).toBe(false);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
    expect(camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-10);
    expect(controls.target.distanceTo(target)).toBeLessThan(1e-10);
    expect(camera.zoom).toBe(zoom);

    for (let index = 0; index < 4; index += 1) {
      controls.update();
      expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
      expect(camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-10);
      expect(controls.target.distanceTo(target)).toBeLessThan(1e-10);
      expect(camera.zoom).toBe(zoom);
    }
  });

  it('can re-enable damping through the same public control', () => {
    const controls = new OrbitControls(new THREE.PerspectiveCamera());

    controls.enableDamping = false;
    setOrbitControlsDamping(controls, true);

    expect(controls.enableDamping).toBe(true);
  });
});
