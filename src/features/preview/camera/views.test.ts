import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyCameraPose, cameraPose, modelBounds, viewDefinition, VIEW_DEFINITIONS } from './views';
describe('viewer camera views', () => {
  const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 1000);
  const center = new THREE.Vector3(2, -3, 1);
  const bounds = modelBounds(125, 25, 4, center);
  it('puts the top camera above the printable XY plane with Y upright', () => {
    const view = viewDefinition('top');
    const pose = cameraPose(camera, bounds, view.direction, view.up);
    expect(pose.position.z).toBeGreaterThan(bounds.max.z);
    expect(pose.target.equals(center)).toBe(true);
    expect(pose.up.y).toBe(1);
    expect(pose.near).toBeGreaterThan(0);
    expect(pose.far).toBeGreaterThan(pose.near);
  });
  it('keeps both side cameras outside a 125 mm model', () => {
    const left = viewDefinition('left');
    const right = viewDefinition('right');
    const leftPose = cameraPose(camera, bounds, left.direction, left.up);
    const rightPose = cameraPose(camera, bounds, right.direction, right.up);
    expect(leftPose.position.x).toBeLessThan(bounds.min.x);
    expect(rightPose.position.x).toBeGreaterThan(bounds.max.x);
  });
  it('moves the camera closer when zoom scale is below one', () => {
    const view = viewDefinition('home');
    const fitted = cameraPose(camera, bounds, view.direction, view.up, 1);
    const close = cameraPose(camera, bounds, view.direction, view.up, 0.42);
    expect(close.position.distanceTo(close.target)).toBeLessThan(fitted.position.distanceTo(fitted.target));
  });
  it('provides a distinct SVG icon identifier for every preset', () => {
    expect(new Set(VIEW_DEFINITIONS.map((view) => view.icon)).size).toBe(VIEW_DEFINITIONS.length);
  });
  it('keeps every corner inside the frustum across arbitrary gesture orientations', () => {
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];
    for (const direction of [
      new THREE.Vector3(1, -0.4, 0.8),
      new THREE.Vector3(-0.7, -0.2, 1),
      new THREE.Vector3(0.25, 0.95, 0.35),
      new THREE.Vector3(-0.9, 0.3, -0.7),
    ]) {
      const pose = cameraPose(camera, bounds, direction, new THREE.Vector3(0, 1, 0));
      applyCameraPose(camera, pose);
      camera.updateMatrixWorld();
      for (const corner of corners) {
        const projected = corner.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
  it('keeps the fitted home distance and clipping planes safe through a full custom orbit', () => {
    const home = cameraPose(camera, bounds, viewDefinition('home').direction, viewDefinition('home').up, 1.16);
    const distance = home.position.distanceTo(home.target);
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.42).normalize();
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.up.set(0, 0, 1);
      camera.near = home.near;
      camera.far = home.far;
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      for (const corner of corners) {
        const projected = corner.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
});
