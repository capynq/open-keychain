import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  clampInspectionPan,
  clampInspectionZoom,
  INSPECTION_ZOOM_STEP,
  inspectionPanFrame,
  panToTargetOffset,
  MAX_INSPECTION_ZOOM,
  MIN_INSPECTION_ZOOM,
  scaleInspectionZoom,
} from './inspection';

describe('inspection camera lens', () => {
  it('keeps magnification in the approved range', () => {
    expect(clampInspectionZoom(0)).toBe(MIN_INSPECTION_ZOOM);
    expect(clampInspectionZoom(10)).toBe(MAX_INSPECTION_ZOOM);
    expect(scaleInspectionZoom(1, INSPECTION_ZOOM_STEP)).toBe(INSPECTION_ZOOM_STEP);
  });

  it('clamps normalized pan independently on each axis', () => {
    expect(clampInspectionPan({ x: -2, y: 0.4 })).toEqual({ x: -1, y: 0.4 });
    expect(clampInspectionPan({ x: 0.2, y: 3 })).toEqual({ x: 0.2, y: 1 });
  });
  it('pans in an orthonormal screen plane at an oblique angle', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-50, -10, -2), new THREE.Vector3(50, 10, 2));
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(80, -100, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const outward = camera.getWorldDirection(new THREE.Vector3()).negate();
    const frame = inspectionPanFrame(bounds, outward, camera.up);
    expect(frame.right.dot(frame.up)).toBeCloseTo(0);
    expect(frame.up.dot(outward)).toBeCloseTo(0);
    const offset = panToTargetOffset({ x: 0.5, y: -0.5 }, bounds, camera, camera.up);
    expect(offset.dot(outward)).toBeCloseTo(0);
    expect(offset.dot(frame.right) / frame.halfWidth).toBeCloseTo(0.5);
    expect(offset.dot(frame.up) / frame.halfHeight).toBeCloseTo(-0.5);
  });
});
