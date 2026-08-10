import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GeometryResult } from '../../../domain/keychain';
import { t, type Locale } from '../../../infrastructure/i18n';
import {
  applyCameraPose,
  cameraPose,
  modelBounds,
  viewDefinition,
  VIEW_DEFINITIONS,
  type CameraViewIconId,
  type ViewId,
} from '../camera/views';
import '../styles/preview.css';
export type SurfacePresetId = 'matte' | 'graph' | 'dark' | 'wood' | 'metal';
type ViewerProps = {
  result: GeometryResult | undefined;
  surfacePreset?: SurfacePresetId;
  locale?: Locale;
};
type ViewerState = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  group: THREE.Group;
  scene: THREE.Scene;
  floor: THREE.Mesh;
  grid: THREE.GridHelper;
  platform: THREE.Mesh;
  key: THREE.DirectionalLight;
  zoomScale: number;
  displayOffsetZ: number;
};
const DEFAULT_ZOOM_SCALE = 0.65;
const MIN_ZOOM_SCALE = 0.42;
const ZOOM_IN_FACTOR = 0.72;
const MAX_ZOOM_SCALE = 3.2;
const SURFACE_SIZE = 1800;
const disposeChildren = (group: THREE.Group): void => {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    }
  }
};
const makeMesh = (
  mesh: GeometryResult['baseMesh'],
  color: string,
  roughness: number,
  flatShading = false,
): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  const shadedGeometry = flatShading ? geometry : toCreasedNormals(geometry, THREE.MathUtils.degToRad(25));
  if (shadedGeometry !== geometry) geometry.dispose();
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, flatShading });
  const object = new THREE.Mesh(shadedGeometry, material);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
};
const CameraViewIcon = ({ icon }: { icon: CameraViewIconId }) => {
  if (icon === 'cube')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5m0 9v-9" />
      </svg>
    );
  if (icon === 'out-of-plane')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 9h10v10H9zM14 14 4 4m0 0v6m0-6h6" />
      </svg>
    );
  if (icon === 'into-plane')
    return (
      <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h10v10H5zM4 4l10 10m0 0V8m0 6H8" />
      </svg>
    );
  const path = {
    'arrow-left': 'M20 12H4m0 0 6-6m-6 6 6 6',
    'arrow-right': 'M4 12h16m0 0-6-6m6 6-6 6',
    'arrow-up': 'M12 20V4m0 0-6 6m6-6 6 6',
    'arrow-down': 'M12 4v16m0 0-6-6m6 6 6-6',
  }[icon];
  return (
    <svg data-icon={icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
};
const fitViewer = (state: ViewerState, result: GeometryResult, selected: ViewId | 'custom', resetZoom = true): void => {
  if (resetZoom) state.zoomScale = DEFAULT_ZOOM_SCALE;
  const center = new THREE.Vector3(...result.dimensions.centerMm);
  center.z += state.displayOffsetZ;
  const bounds = modelBounds(
    result.dimensions.widthMm,
    result.dimensions.heightMm,
    result.dimensions.thicknessMm,
    center,
  );
  const direction =
    selected === 'custom' ? state.camera.position.clone().sub(center).normalize() : viewDefinition(selected).direction;
  const up = selected === 'custom' ? state.camera.up : viewDefinition(selected).up;
  const pose = cameraPose(state.camera, bounds, direction, up, state.zoomScale);
  applyCameraPose(state.camera, pose);
  state.controls.target.copy(pose.target);
  state.controls.cursor.copy(pose.target);
  state.controls.update();
};
const syncPlatform = (state: ViewerState, result: GeometryResult | undefined): void => {
  if (!result || !state.platform.visible) return;
  const width = Math.max(32, result.dimensions.widthMm + 24);
  const depth = Math.max(28, result.dimensions.heightMm + 24);
  const thickness = 3.6;
  const radius = Math.min(5, Math.min(width, depth) * 0.16);
  state.platform.geometry.dispose();
  state.platform.geometry = new RoundedBoxGeometry(width, depth, thickness, 5, radius);
  state.platform.position.set(result.dimensions.centerMm[0], result.dimensions.centerMm[1], -thickness / 2);
  state.platform.receiveShadow = true;
};
export const Viewer = ({ result, surfacePreset = 'matte', locale = 'en' }: ViewerProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewerState | undefined>(undefined);
  const resultRef = useRef<GeometryResult | undefined>(result);
  const activeViewRef = useRef<ViewId | 'custom'>('home');
  const [activeView, setActiveView] = useState<ViewId | 'custom'>('home');
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  const setView = useCallback(
    (id: ViewId) => {
      const state = stateRef.current;
      if (!state || !result) return;
      activeViewRef.current = id;
      setActiveView(id);
      fitViewer(state, result, id);
    },
    [result],
  );
  const zoomBy = useCallback((factor: number) => {
    const state = stateRef.current;
    const current = resultRef.current;
    if (!state || !current) return;
    state.zoomScale = THREE.MathUtils.clamp(state.zoomScale * factor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
    fitViewer(state, current, activeViewRef.current, false);
    setActiveView(activeViewRef.current);
  }, []);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eee8df');
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    host.prepend(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.68;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = true;
    controls.cursor.set(0, 0, 0);
    controls.minTargetRadius = 0;
    controls.maxTargetRadius = 0;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.ROTATE;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.addEventListener('start', () => {
      activeViewRef.current = 'custom';
      setActiveView('custom');
      const current = resultRef.current;
      if (current && stateRef.current) {
        const target = new THREE.Vector3(...current.dimensions.centerMm);
        target.z += stateRef.current.displayOffsetZ;
        stateRef.current.controls.target.copy(target);
        stateRef.current.controls.cursor.copy(target);
      }
    });
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.HemisphereLight('#fff8ec', '#7f8796', 2.2));
    const key = new THREE.DirectionalLight('#fff9ed', 3.2);
    key.position.set(-48, -64, 92);
    key.castShadow = true;
    key.shadow.mapSize.set(window.innerWidth < 760 ? 1024 : 2048, window.innerWidth < 760 ? 1024 : 2048);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.025;
    key.shadow.camera.left = -100;
    key.shadow.camera.right = 100;
    key.shadow.camera.top = 100;
    key.shadow.camera.bottom = -100;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#d8c2b0', 2.1);
    rim.position.set(64, 32, 48);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(SURFACE_SIZE, SURFACE_SIZE),
      new THREE.MeshStandardMaterial({ color: '#eee8df', roughness: 0.92, metalness: 0 }),
    );
    floor.position.z = -0.08;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(SURFACE_SIZE, 90, '#b8b0a6', '#d2cbc1');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.06;
    grid.visible = false;
    scene.add(grid);
    const platform = new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 3, 0.2),
      new THREE.MeshStandardMaterial({ color: '#a87850', roughness: 0.68, metalness: 0 }),
    );
    platform.visible = false;
    scene.add(platform);
    const viewerState: ViewerState = {
      camera,
      controls,
      group,
      scene,
      floor,
      grid,
      platform,
      key,
      zoomScale: 1,
      displayOffsetZ: 0,
    };
    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const current = resultRef.current;
      if (current) fitViewer(viewerState, current, activeViewRef.current, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    stateRef.current = viewerState;
    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      disposeChildren(group);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      platform.geometry.dispose();
      (platform.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = undefined;
    };
  }, []);
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !result) return;
    disposeChildren(state.group);
    state.group.add(makeMesh(result.baseMesh, result.appearance.base.color, 0.42, result.baseShading === 'flat'));
    state.group.add(makeMesh(result.reliefMesh, result.appearance.relief.color, 0.3));
    const center = new THREE.Vector3(...result.dimensions.centerMm);
    state.floor.position.set(center.x, center.y, state.platform.visible ? -3.72 : -0.08);
    state.grid.position.set(center.x, center.y, state.platform.visible ? -3.7 : -0.06);
    state.displayOffsetZ = state.platform.visible ? 3.72 : 0;
    state.group.position.z = state.displayOffsetZ;
    syncPlatform(state, result);
    const selected = activeViewRef.current;
    const maxDimension = Math.max(result.dimensions.widthMm, result.dimensions.heightMm, result.dimensions.thicknessMm);
    const shadowSpan = maxDimension * 0.72;
    state.key.shadow.camera.left = -shadowSpan;
    state.key.shadow.camera.right = shadowSpan;
    state.key.shadow.camera.top = shadowSpan;
    state.key.shadow.camera.bottom = -shadowSpan;
    state.key.shadow.camera.near = 0.1;
    state.key.shadow.camera.far = Math.max(300, maxDimension * 4);
    state.key.shadow.camera.updateProjectionMatrix();
    fitViewer(state, result, selected);
  }, [result]);
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const floorMaterial = state.floor.material as THREE.MeshStandardMaterial;
    const presets: Record<
      SurfacePresetId,
      {
        background: string;
        roughness: number;
        metalness: number;
        grid: boolean;
        platform: boolean;
        platformColor: string;
      }
    > = {
      matte: {
        background: '#eee8df',
        roughness: 0.92,
        metalness: 0,
        grid: false,
        platform: false,
        platformColor: '#a87850',
      },
      graph: {
        background: '#e7e4de',
        roughness: 0.86,
        metalness: 0,
        grid: true,
        platform: false,
        platformColor: '#a87850',
      },
      dark: {
        background: '#202735',
        roughness: 0.8,
        metalness: 0.05,
        grid: false,
        platform: false,
        platformColor: '#555b65',
      },
      wood: {
        background: '#d8d0c4',
        roughness: 0.82,
        metalness: 0,
        grid: true,
        platform: true,
        platformColor: '#9a6746',
      },
      metal: {
        background: '#d4d8dc',
        roughness: 0.48,
        metalness: 0.32,
        grid: true,
        platform: true,
        platformColor: '#6e7781',
      },
    };
    const preset = presets[surfacePreset];
    state.scene.background = new THREE.Color(preset.background);
    floorMaterial.color.set(preset.background);
    floorMaterial.roughness = preset.roughness;
    floorMaterial.metalness = preset.metalness;
    state.grid.visible = preset.grid;
    state.platform.visible = preset.platform;
    const platformMaterial = state.platform.material as THREE.MeshStandardMaterial;
    platformMaterial.color.set(preset.platformColor);
    platformMaterial.roughness = preset.roughness;
    platformMaterial.metalness = preset.metalness;
    const current = resultRef.current;
    state.displayOffsetZ = preset.platform ? 3.72 : 0;
    state.group.position.z = state.displayOffsetZ;
    if (current) {
      const center = new THREE.Vector3(...current.dimensions.centerMm);
      state.floor.position.set(center.x, center.y, preset.platform ? -3.72 : -0.08);
      state.grid.position.set(center.x, center.y, preset.platform ? -3.7 : -0.06);
      syncPlatform(state, current);
      fitViewer(state, current, activeViewRef.current, false);
    }
  }, [surfacePreset]);
  return (
    <div className="viewer" aria-label="Interactive 3D preview" data-view={activeView} data-surface={surfacePreset}>
      <div className="viewer-surface" ref={hostRef}>
        <p className="viewer-caption">{t(locale, 'dragRotate')}</p>
      </div>
      <div className="viewer-toolbar" aria-label="Preview camera views">
        {VIEW_DEFINITIONS.map((view) => (
          <button
            type="button"
            key={view.id}
            className={activeView === view.id ? 'active' : ''}
            aria-label={t(locale, view.id === 'home' ? 'home' : view.id)}
            aria-pressed={activeView === view.id}
            title={t(locale, view.id === 'home' ? 'home' : view.id)}
            onClick={() => setView(view.id)}
          >
            <CameraViewIcon icon={view.icon} />
          </button>
        ))}
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          aria-label={t(locale, 'zoomOut')}
          title={t(locale, 'zoomOut')}
          onClick={() => zoomBy(1.22)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={t(locale, 'zoomIn')}
          title={t(locale, 'zoomIn')}
          onClick={() => zoomBy(ZOOM_IN_FACTOR)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
};
