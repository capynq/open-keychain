import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { inspectionSnapshot, validInspectionCamera } from './inspection-snapshot';

const fitted = () => {
  const camera = new THREE.PerspectiveCamera(36, 1.5, 0.01, 1000);
  camera.position.set(0, -100, 100);
  return camera;
};

describe('inspection recovery snapshots', () => {
  it('does not save unfitted Strict Mode cleanup or a coincident camera and target', () => {
    const camera = fitted();
    expect(
      inspectionSnapshot(camera, new THREE.Vector3(), { x: 0, y: 0 }, 'home', false),
    ).toBeUndefined();
    camera.position.set(0, 0, 0);
    expect(
      inspectionSnapshot(camera, new THREE.Vector3(), { x: 0, y: 0 }, 'home', true),
    ).toBeUndefined();
  });
  it('keeps an independent orientation and inspection snapshot without absolute model coordinates', () => {
    const camera = fitted();
    camera.zoom = 2.44;
    const pan = { x: 0.2, y: -0.1 };
    const snapshot = inspectionSnapshot(camera, new THREE.Vector3(5, 3, 1), pan, 'custom', true)!;
    const direction = snapshot.direction.clone();
    camera.position.set(100, 0, 0);
    pan.x = 1;
    expect(snapshot.direction).toEqual(direction);
    expect(snapshot.direction.length()).toBeCloseTo(1);
    expect(snapshot.zoom).toBe(2.44);
    expect(snapshot.pan).toEqual({ x: 0.2, y: -0.1 });
    expect(snapshot.view).toBe('custom');
    expect(snapshot).not.toHaveProperty('position');
  });
  it.each(['position', 'up', 'zoom', 'near', 'far', 'aspect'] as const)(
    'rejects nonfinite %s',
    (property) => {
      const camera = fitted();
      if (property === 'position' || property === 'up') camera[property].x = Number.NaN;
      else camera[property] = Number.NaN;
      expect(validInspectionCamera(camera, new THREE.Vector3())).toBe(false);
    },
  );
  it('rejects a collinear up vector, invalid projection and unbounded pan', () => {
    const camera = fitted();
    camera.up.copy(camera.position).normalize();
    expect(validInspectionCamera(camera, new THREE.Vector3())).toBe(false);
    camera.up.set(0, 1, 0);
    camera.far = camera.near;
    expect(validInspectionCamera(camera, new THREE.Vector3())).toBe(false);
    camera.far = 1000;
    expect(
      inspectionSnapshot(camera, new THREE.Vector3(), { x: 1.1, y: 0 }, 'home', true),
    ).toBeUndefined();
  });
});
