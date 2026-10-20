import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

import { recoveryMessage, recoverySteps } from '@/infrastructure/i18n/utils';
import { RecoveryError, type RecoveryFailure } from '@/shared/lib/recovery/failure';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import type { GeometryResult, PrintAppearance } from '../../../../domain/keychain/model/types';
import type { Locale } from '../../../../infrastructure/i18n/config';
import type { PhotoCaptureApi } from '../../model/photo-capture';
import type { PhotoFormat } from '../../model/photo-format';
import type { PreviewRenderState } from '../../model/render-state';

import { t } from '../../../../infrastructure/i18n/utils';
import {
  clampInspectionPan,
  INSPECTION_ZOOM_STEP,
  inspectionPanFrame,
  panToTargetOffset,
  scaleInspectionZoom,
  type InspectionPan,
} from '../../camera/inspection';
import {
  inspectionSnapshot,
  validInspectionCamera,
  type InspectionSnapshot,
} from '../../camera/inspection-snapshot';
import {
  applyCameraPose,
  fittedCameraPose,
  MIN_CAMERA_NEAR,
  modelBounds,
  viewDefinition,
  VIEW_DEFINITIONS,
  type ViewId,
} from '../../camera/views';
import { setOrbitControlsDamping } from '../../model/reduced-motion';
import { CameraViewIcon } from './CameraViewIcon';
import { createSurfaceMaterials, type SurfaceMaterials } from './surface-materials';
import styles from './Viewer.module.css';
import '../../styles/preview.css';
export type SurfacePresetId = 'matte' | 'graph' | 'dark' | 'wood' | 'metal';
type ViewerProps = {
  result: GeometryResult | undefined;
  appearance?: PrintAppearance;
  surfacePreset?: SurfacePresetId;
  locale?: Locale;
  templateId?: string;
  onStateChange?: (state: PreviewRenderState) => void;
  onRetry?: () => void;
  restartKey?: number;
  toolbarAction?: ReactNode;
  onPhotoCaptureChange?: (capture: PhotoCaptureApi | undefined) => void;
};
type ViewerState = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  group: THREE.Group;
  scene: THREE.Scene;
  floor: THREE.Mesh;
  grid: THREE.GridHelper;
  platform: THREE.Mesh;
  platformBaseMaterial: THREE.MeshStandardMaterial;
  surfaceMaterials?: SurfaceMaterials;
  key: THREE.DirectionalLight;
  inspectionZoom: number;
  inspectionPan: InspectionPan;
  fitTarget: THREE.Vector3;
  panRight: THREE.Vector3;
  panUp: THREE.Vector3;
  panHalfWidth: number;
  panHalfHeight: number;
  displayOffsetZ: number;
  installedGenerationId?: number;
  fail: (code: string, message?: string) => void;
  invalidate?: () => void;
};
const DEFAULT_INSPECTION_ZOOM = 1;
const SURFACE_SIZE = 1800;
const BOARD_THICKNESS = 5.2;
const BOARD_DISPLAY_OFFSET = BOARD_THICKNESS + 0.2;
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
  const shadedGeometry = flatShading
    ? geometry
    : toCreasedNormals(geometry, THREE.MathUtils.degToRad(25));
  if (shadedGeometry !== geometry) geometry.dispose();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    flatShading,
  });
  const object = new THREE.Mesh(shadedGeometry, material);

  object.castShadow = true;
  object.receiveShadow = true;
  return object;
};
const fitViewer = (
  state: ViewerState,
  result: GeometryResult,
  selected: ViewId | 'custom',
  resetInspection = false,
  onInspectionChange?: (zoom: number, pan: InspectionPan) => void,
  orientation?: Pick<InspectionSnapshot, 'direction' | 'up'>,
): void => {
  if (resetInspection) {
    state.inspectionZoom = DEFAULT_INSPECTION_ZOOM;
    state.inspectionPan = { x: 0, y: 0 };
  }
  const center = new THREE.Vector3(...result.dimensions.centerMm);

  center.z += state.displayOffsetZ;
  const bounds = modelBounds(
    result.dimensions.widthMm,
    result.dimensions.heightMm,
    result.dimensions.thicknessMm,
    center,
  );
  // Surface scenery must never change model framing or the inspection pan frame.
  const direction =
    orientation?.direction ??
    (selected === 'custom'
      ? state.camera.position.clone().sub(state.controls.target).normalize()
      : viewDefinition(selected).direction);
  const up =
    orientation?.up ?? (selected === 'custom' ? state.camera.up : viewDefinition(selected).up);
  if (
    !direction.toArray().every(Number.isFinite) ||
    direction.lengthSq() < 1e-8 ||
    direction.clone().normalize().cross(up.clone().normalize()).lengthSq() < 1e-8
  ) {
    fitViewer(state, result, 'home', true, onInspectionChange);
    return;
  }
  const inspectionZoom = state.inspectionZoom;

  state.camera.zoom = DEFAULT_INSPECTION_ZOOM;
  state.camera.updateProjectionMatrix();
  const fitted = fittedCameraPose(state.camera, bounds, direction, up, 1);
  const pose = fitted.pose;

  // The display floor spans beyond the fitted model and can cross its near plane.
  if (state.platform.visible) pose.near = Math.min(pose.near, 0.1);
  applyCameraPose(state.camera, pose);
  state.camera.zoom = inspectionZoom;
  state.camera.updateProjectionMatrix();
  state.controls.enablePan = inspectionZoom > DEFAULT_INSPECTION_ZOOM;
  const panOffset = panToTargetOffset(state.inspectionPan, bounds, state.camera, pose.up);

  state.fitTarget.copy(pose.target);
  const frame = inspectionPanFrame(bounds, direction, pose.up);

  state.panRight.copy(frame.right);
  state.panUp.copy(frame.up);
  state.panHalfWidth = frame.halfWidth;
  state.panHalfHeight = frame.halfHeight;
  state.camera.position.add(panOffset);
  state.controls.target.copy(pose.target).add(panOffset);
  state.controls.cursor.copy(pose.target);
  state.controls.update();
  onInspectionChange?.(state.inspectionZoom, state.inspectionPan);
};
const syncPlatform = (state: ViewerState, result: GeometryResult | undefined): void => {
  if (!result || !state.platform.visible) return;
  const width = Math.max(40, result.dimensions.widthMm + 36);
  const depth = Math.max(36, result.dimensions.heightMm + 36);
  const radius = Math.min(7, Math.min(width, depth) * 0.16);

  state.platform.geometry.dispose();
  state.platform.geometry = new RoundedBoxGeometry(width, depth, BOARD_THICKNESS, 8, radius);
  state.platform.position.set(
    result.dimensions.centerMm[0],
    result.dimensions.centerMm[1],
    -BOARD_THICKNESS / 2,
  );
  state.platform.castShadow = true;
  state.platform.receiveShadow = true;
};
export const Viewer = ({
  result,
  appearance = result?.appearance,
  surfacePreset = 'matte',
  locale = 'en',
  templateId,
  onStateChange,
  onRetry,
  restartKey = 0,
  onPhotoCaptureChange,
  toolbarAction,
}: ViewerProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<ViewerState | undefined>(undefined);
  const recoveryPose = useRef<InspectionSnapshot | undefined>(undefined);
  const sessionCounter = useRef(0);

  const resultRef = useRef<GeometryResult | undefined>(result);
  const renderedGenerationRef = useRef<number | undefined>(undefined);
  const pendingRenderTimingsRef = useRef<{ generationId: number; meshSetupMs: number } | undefined>(
    undefined,
  );
  const onStateChangeRef = useRef(onStateChange);
  const onPhotoCaptureChangeRef = useRef(onPhotoCaptureChange);
  const initializationMsRef = useRef<number | undefined>(undefined);

  const activeViewRef = useRef<ViewId | 'custom'>('home');
  const templateIdRef = useRef(templateId);

  const [activeView, setActiveView] = useState<ViewId | 'custom'>('home');
  const [inspectionZoom, setInspectionZoom] = useState(DEFAULT_INSPECTION_ZOOM);
  const [, setInspectionPan] = useState<InspectionPan>({ x: 0, y: 0 });
  const [previewFailure, setPreviewFailure] = useState<RecoveryFailure>();
  const [previewCapability, setPreviewCapability] = useState<'available' | 'unavailable'>(
    'available',
  );

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onPhotoCaptureChangeRef.current = onPhotoCaptureChange;
  }, [onPhotoCaptureChange]);

  const setView = useCallback(
    (id: ViewId) => {
      const state = stateRef.current;
      if (!state || !result) return;
      activeViewRef.current = id;
      setActiveView(id);
      state.inspectionPan = { x: 0, y: 0 };
      fitViewer(state, result, id, id === 'home', (zoom, pan) => {
        setInspectionZoom(zoom);
        setInspectionPan(pan);
      });
      state.invalidate?.();
    },
    [result],
  );

  const zoomBy = useCallback((factor: number) => {
    const state = stateRef.current;
    const current = resultRef.current;
    if (!state || !current) return;
    state.inspectionZoom = scaleInspectionZoom(state.inspectionZoom, factor);
    if (state.inspectionZoom <= DEFAULT_INSPECTION_ZOOM) state.inspectionPan = { x: 0, y: 0 };
    state.controls.enablePan = state.inspectionZoom > DEFAULT_INSPECTION_ZOOM;
    state.camera.zoom = state.inspectionZoom;
    state.camera.updateProjectionMatrix();
    if (state.inspectionZoom <= DEFAULT_INSPECTION_ZOOM)
      fitViewer(state, current, activeViewRef.current, false);
    setInspectionZoom(state.inspectionZoom);
    state.invalidate?.();
    setActiveView(activeViewRef.current);
  }, []);

  const resetInspection = useCallback((resetAngle = false) => {
    const state = stateRef.current;
    const current = resultRef.current;
    if (!state || !current) return;
    state.inspectionZoom = DEFAULT_INSPECTION_ZOOM;
    state.inspectionPan = { x: 0, y: 0 };
    state.controls.enablePan = false;
    fitViewer(state, current, resetAngle ? 'home' : 'custom', resetAngle, (zoom, pan) => {
      setInspectionZoom(zoom);
      setInspectionPan(pan);
    });
    if (resetAngle) {
      activeViewRef.current = 'home';
      setActiveView('home');
    }
    state.invalidate?.();
  }, []);

  const panBy = useCallback((x: number, y: number) => {
    const state = stateRef.current;
    const current = resultRef.current;
    if (!state || !current || state.inspectionZoom <= DEFAULT_INSPECTION_ZOOM) return;
    state.inspectionPan = clampInspectionPan({
      x: state.inspectionPan.x + x,
      y: state.inspectionPan.y + y,
    });
    fitViewer(state, current, activeViewRef.current, false, (zoom, pan) => {
      setInspectionZoom(zoom);
      setInspectionPan(pan);
    });
    state.invalidate?.();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const initializationStartedAt = performance.now();
    const sessionId = ++sessionCounter.current;
    let disposed = false;
    let failed = false;
    let frame = 0;
    const publish = (state: PreviewRenderState): void => {
      if (!disposed && sessionId === sessionCounter.current) onStateChangeRef.current?.(state);
    };
    const fail = (code: string, message?: string): void => {
      if (disposed || failed) return;
      failed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      onPhotoCaptureChangeRef.current?.(undefined);
      setPreviewCapability('unavailable');
      setPreviewFailure({ code, message });
      publish({ status: 'failed', sessionId, failure: { code, message } });
    };

    publish({ status: restartKey > 0 ? 'recovering' : 'initializing', sessionId });

    renderedGenerationRef.current = undefined;
    const scene = new THREE.Scene();

    scene.background = new THREE.Color('#eee8df');
    const camera = new THREE.PerspectiveCamera(36, 1, MIN_CAMERA_NEAR, 1000);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (cause) {
      fail('preview-render-failed', cause instanceof Error ? cause.message : undefined);
      return () => {
        disposed = true;
      };
    }

    const handleContextLost = (event: Event): void => {
      event.preventDefault();
      fail('preview-context-lost', 'The WebGL context was lost.');
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), false);
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
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.PAN;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    const handleWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
      const factor = Math.exp(-event.deltaY * unit * 0.0015);

      viewerState.inspectionZoom = scaleInspectionZoom(viewerState.inspectionZoom, factor);
      if (viewerState.inspectionZoom <= DEFAULT_INSPECTION_ZOOM)
        viewerState.inspectionPan = { x: 0, y: 0 };
      viewerState.controls.enablePan = viewerState.inspectionZoom > DEFAULT_INSPECTION_ZOOM;
      camera.zoom = viewerState.inspectionZoom;
      camera.updateProjectionMatrix();
      const current = resultRef.current;
      if (viewerState.inspectionZoom <= DEFAULT_INSPECTION_ZOOM && current)
        fitViewer(viewerState, current, activeViewRef.current, false);
      setInspectionZoom(viewerState.inspectionZoom);
      invalidate();
    };
    let pinchDistance: number | undefined;
    const handleTouchStart = (event: TouchEvent): void => {
      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;

        pinchDistance = Math.hypot(dx, dy);
      }
    };
    const handleTouchMove = (event: TouchEvent): void => {
      if (event.touches.length !== 2 || pinchDistance === undefined) return;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const nextDistance = Math.max(1, Math.hypot(dx, dy));

      viewerState.inspectionZoom = scaleInspectionZoom(
        viewerState.inspectionZoom,
        nextDistance / pinchDistance,
      );
      if (viewerState.inspectionZoom <= DEFAULT_INSPECTION_ZOOM)
        viewerState.inspectionPan = { x: 0, y: 0 };
      viewerState.controls.enablePan = viewerState.inspectionZoom > DEFAULT_INSPECTION_ZOOM;
      pinchDistance = nextDistance;
      camera.zoom = viewerState.inspectionZoom;
      camera.updateProjectionMatrix();
      const current = resultRef.current;
      if (viewerState.inspectionZoom <= DEFAULT_INSPECTION_ZOOM && current)
        fitViewer(viewerState, current, activeViewRef.current, false);
      setInspectionZoom(viewerState.inspectionZoom);
      invalidate();
    };
    const handleTouchEnd = (): void => {
      pinchDistance = undefined;
    };

    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    controls.addEventListener('start', () => {
      activeViewRef.current = 'custom';
      setActiveView('custom');
    });
    const group = new THREE.Group();

    scene.add(group);
    scene.add(new THREE.HemisphereLight('#fff8ec', '#7f8796', 2.2));
    const key = new THREE.DirectionalLight('#fff9ed', 3.2);

    key.position.set(-48, -64, 92);
    key.castShadow = true;
    key.shadow.mapSize.set(
      window.innerWidth < 760 ? 1024 : 2048,
      window.innerWidth < 760 ? 1024 : 2048,
    );
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
    const platformBaseMaterial = new THREE.MeshStandardMaterial({
      color: '#a87850',
      roughness: 0.68,
      metalness: 0,
    });
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
    const platform = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 3, 0.2), platformBaseMaterial);

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
      platformBaseMaterial,
      key,
      inspectionZoom: DEFAULT_INSPECTION_ZOOM,
      inspectionPan: { x: 0, y: 0 },
      fitTarget: new THREE.Vector3(),
      panRight: new THREE.Vector3(1, 0, 0),
      panUp: new THREE.Vector3(0, 1, 0),
      panHalfWidth: 1,
      panHalfHeight: 1,
      displayOffsetZ: 0,
      fail,
    };
    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);

      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const current = resultRef.current;
      if (current)
        fitViewer(viewerState, current, activeViewRef.current, false, (zoom, pan) => {
          setInspectionZoom(zoom);
          setInspectionPan(pan);
        });
      invalidate();
    };
    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(host);
    const render = () => {
      frame = 0;
      if (disposed || failed) return;
      controls.update();
      const current = resultRef.current;
      const pendingTimings =
        current && pendingRenderTimingsRef.current?.generationId === current.generationId
          ? pendingRenderTimingsRef.current
          : undefined;
      const drawStartedAt = pendingTimings ? performance.now() : undefined;

      if (
        current &&
        viewerState.installedGenerationId === current.generationId &&
        !validInspectionCamera(camera, controls.target)
      ) {
        fitViewer(viewerState, current, 'home', true, (zoom, pan) => {
          setInspectionZoom(zoom);
          setInspectionPan(pan);
        });
        activeViewRef.current = 'home';
        setActiveView('home');
        if (!validInspectionCamera(camera, controls.target)) {
          fail('preview-camera-invalid', 'Camera fitting did not produce a valid inspection pose.');
          return;
        }
      }
      try {
        if (renderer.getContext().isContextLost()) {
          fail('preview-context-lost');
          return;
        }
        renderer.render(scene, camera);
      } catch (cause) {
        fail('preview-render-failed', cause instanceof Error ? cause.message : undefined);
        return;
      }
      renderer.domElement.dataset.renderedWidth = String(renderer.domElement.width);
      renderer.domElement.dataset.renderedHeight = String(renderer.domElement.height);
      const drawSubmitMs =
        drawStartedAt === undefined ? undefined : performance.now() - drawStartedAt;

      if (
        current &&
        viewerState.installedGenerationId === current.generationId &&
        viewerState.group.children.length >= 2 &&
        validInspectionCamera(camera, controls.target) &&
        renderedGenerationRef.current !== current.generationId
      ) {
        renderedGenerationRef.current = current.generationId;
        publish({
          status: 'ready',
          sessionId,
          generationId: current.generationId,
          timings:
            pendingTimings && drawSubmitMs !== undefined
              ? {
                  renderedAt: performance.now(),
                  meshSetupMs: pendingTimings.meshSetupMs,
                  drawSubmitMs,
                  initializationMs: initializationMsRef.current,
                }
              : undefined,
        });
        if (pendingTimings) pendingRenderTimingsRef.current = undefined;
      }
    };
    const invalidate = () => {
      if (!disposed && !failed && frame === 0) frame = requestAnimationFrame(render);
    };
    let suppressControlsChange = false;
    const handleControlsChange = () => {
      if (suppressControlsChange) return;
      const current = resultRef.current;
      if (current) {
        const center = new THREE.Vector3(...current.dimensions.centerMm);

        center.z += viewerState.displayOffsetZ;
        const frame = inspectionPanFrame(
          modelBounds(
            current.dimensions.widthMm,
            current.dimensions.heightMm,
            current.dimensions.thicknessMm,
            center,
          ),
          camera.position.clone().sub(controls.target),
          camera.up,
        );

        viewerState.panRight.copy(frame.right);
        viewerState.panUp.copy(frame.up);
        viewerState.panHalfWidth = frame.halfWidth;
        viewerState.panHalfHeight = frame.halfHeight;
      }
      const delta = viewerState.controls.target.clone().sub(viewerState.fitTarget);

      viewerState.inspectionPan = clampInspectionPan({
        x: delta.dot(viewerState.panRight) / viewerState.panHalfWidth,
        y: delta.dot(viewerState.panUp) / viewerState.panHalfHeight,
      });
      if (viewerState.inspectionZoom <= DEFAULT_INSPECTION_ZOOM) {
        viewerState.inspectionPan = { x: 0, y: 0 };
        viewerState.camera.position.sub(delta);
        viewerState.controls.target.copy(viewerState.fitTarget);
      } else {
        const boundedTarget = viewerState.fitTarget
          .clone()
          .addScaledVector(
            viewerState.panRight,
            viewerState.inspectionPan.x * viewerState.panHalfWidth,
          )
          .addScaledVector(
            viewerState.panUp,
            viewerState.inspectionPan.y * viewerState.panHalfHeight,
          );
        const correction = boundedTarget.clone().sub(viewerState.controls.target);

        viewerState.controls.target.copy(boundedTarget);
        viewerState.camera.position.add(correction);
      }
      setInspectionPan(viewerState.inspectionPan);
      invalidate();
    };

    const capturePreview = async (longEdge: number, format: PhotoFormat = 'png'): Promise<Blob> => {
      if (
        disposed ||
        failed ||
        !resultRef.current ||
        viewerState.installedGenerationId !== resultRef.current.generationId ||
        stateRef.current !== viewerState ||
        renderer.getContext().isContextLost()
      )
        throw new Error('The 3D preview is not available.');
      if (
        !Number.isInteger(longEdge) ||
        longEdge < 1 ||
        longEdge > renderer.capabilities.maxTextureSize
      )
        throw new Error('The selected image size is not supported.');

      const aspect = camera.aspect;
      const width = Math.max(1, Math.round(longEdge * Math.min(aspect, 1)));
      const height = Math.max(1, Math.round(longEdge / Math.max(aspect, 1)));

      const photoCamera = camera.clone();

      photoCamera.aspect = width / height;
      photoCamera.updateProjectionMatrix();
      const target = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        samples: Math.min(4, renderer.capabilities.maxSamples),
        depthBuffer: true,
        stencilBuffer: false,
      });

      target.texture.colorSpace = THREE.SRGBColorSpace;
      target.texture.generateMipmaps = false;
      const previousTarget = renderer.getRenderTarget();
      const previousViewport = renderer.getViewport(new THREE.Vector4());
      const previousScissor = renderer.getScissor(new THREE.Vector4());
      const previousScissorTest = renderer.getScissorTest();

      try {
        try {
          renderer.setRenderTarget(target);
          renderer.setViewport(0, 0, width, height);
          renderer.setScissorTest(false);
          renderer.clear(true, true, true);
          renderer.render(scene, photoCamera);
        } finally {
          renderer.setRenderTarget(previousTarget);
          renderer.setViewport(previousViewport);
          renderer.setScissor(previousScissor);
          renderer.setScissorTest(previousScissorTest);
        }
        const pixels = new Uint8Array(width * height * 4);

        await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels);
        const rowLength = width * 4;
        const rowBuffer = new Uint8Array(rowLength);
        for (let row = 0; row < Math.floor(height / 2); row += 1) {
          const top = row * rowLength;
          const bottom = (height - row - 1) * rowLength;

          rowBuffer.set(pixels.subarray(top, top + rowLength));
          pixels.copyWithin(top, bottom, bottom + rowLength);
          pixels.set(rowBuffer, bottom);
        }
        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context)
          throw new RecoveryError({
            code: 'canvas-unavailable',
            message: 'Canvas 2D is unavailable.',
          });
        context.putImageData(
          new ImageData(new Uint8ClampedArray(pixels.buffer), width, height),
          0,
          0,
        );
        return await new Promise<Blob>((resolve, reject) => {
          const handleBlob = (blob: Blob | null): void =>
            blob
              ? resolve(blob)
              : reject(
                  new RecoveryError({
                    code: 'image-encoding-failed',
                    message: 'Image encoding failed.',
                  }),
                );
          if (format === 'jpg') canvas.toBlob(handleBlob, 'image/jpeg', 0.92);
          else canvas.toBlob(handleBlob, 'image/png');
        });
      } finally {
        target.dispose();
      }
    };

    controls.addEventListener('change', handleControlsChange);
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyReducedMotion = (reduce: boolean): void => {
      suppressControlsChange = true;
      try {
        setOrbitControlsDamping(controls, !reduce);
      } finally {
        suppressControlsChange = false;
      }
      invalidate();
    };
    const handleReducedMotionChange = (event: MediaQueryListEvent): void => {
      applyReducedMotion(event.matches);
    };

    applyReducedMotion(reducedMotionQuery.matches);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    viewerState.invalidate = invalidate;
    stateRef.current = viewerState;
    let captureQueue = Promise.resolve();
    const captureApi: PhotoCaptureApi = {
      maxTextureSize: renderer.capabilities.maxTextureSize,
      capture: (options, format = 'png') => {
        const task = captureQueue.then(() => capturePreview(options, format));

        captureQueue = task.then(
          () => undefined,
          () => undefined,
        );
        return task;
      },
    };

    if (!failed && !disposed) onPhotoCaptureChangeRef.current?.(captureApi);
    queueMicrotask(() => {
      if (!disposed && !failed) {
        setPreviewCapability('available');
        setPreviewFailure(undefined);
      }
    });
    resize();
    initializationMsRef.current = performance.now() - initializationStartedAt;
    invalidate();

    return () => {
      disposed = true;
      const snapshot = inspectionSnapshot(
        camera,
        controls.target,
        viewerState.inspectionPan,
        activeViewRef.current,
        viewerState.installedGenerationId !== undefined,
      );
      if (snapshot) recoveryPose.current = snapshot;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.removeEventListener('change', handleControlsChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      controls.dispose();
      onPhotoCaptureChangeRef.current?.(undefined);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      disposeChildren(group);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      platform.geometry.dispose();
      platformBaseMaterial.dispose();
      viewerState.surfaceMaterials?.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.remove();
      stateRef.current = undefined;
    };
  }, [restartKey]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !result) return;
    const meshSetupStartedAt = performance.now();

    try {
      disposeChildren(state.group);
      state.installedGenerationId = undefined;
      state.group.add(
        makeMesh(
          result.baseMesh,
          result.appearance.base.color,
          0.42,
          result.baseShading === 'flat',
        ),
      );
      state.group.add(makeMesh(result.reliefMesh, result.appearance.relief.color, 0.3));
      const center = new THREE.Vector3(...result.dimensions.centerMm);

      state.floor.position.set(
        center.x,
        center.y,
        state.platform.visible ? -BOARD_DISPLAY_OFFSET : -0.08,
      );
      state.grid.position.set(
        center.x,
        center.y,
        state.platform.visible ? -BOARD_DISPLAY_OFFSET + 0.02 : -0.06,
      );
      state.displayOffsetZ = state.platform.visible ? BOARD_DISPLAY_OFFSET : 0;
      state.group.position.z = state.displayOffsetZ;
      syncPlatform(state, result);
      const maxDimension = Math.max(
        result.dimensions.widthMm,
        result.dimensions.heightMm,
        result.dimensions.thicknessMm,
      );
      const shadowSpan = maxDimension * 0.72;

      state.key.shadow.camera.left = -shadowSpan;
      state.key.shadow.camera.right = shadowSpan;
      state.key.shadow.camera.top = shadowSpan;
      state.key.shadow.camera.bottom = -shadowSpan;
      state.key.shadow.camera.near = 0.1;
      state.key.shadow.camera.far = Math.max(300, maxDimension * 4);
      state.key.shadow.camera.updateProjectionMatrix();
      if (templateIdRef.current !== templateId) {
        templateIdRef.current = templateId;
        state.inspectionZoom = DEFAULT_INSPECTION_ZOOM;
        state.inspectionPan = { x: 0, y: 0 };
        state.controls.enablePan = false;
      }
      const pose = recoveryPose.current;
      if (pose) {
        state.inspectionZoom = pose.zoom;
        state.inspectionPan = { ...pose.pan };
        activeViewRef.current = pose.view;
        setActiveView(pose.view);
      }
      fitViewer(
        state,
        result,
        activeViewRef.current,
        false,
        (zoom, pan) => {
          setInspectionZoom(zoom);
          setInspectionPan(pan);
        },
        pose,
      );
      recoveryPose.current = undefined;
      if (!validInspectionCamera(state.camera, state.controls.target)) {
        throw new RecoveryError({ code: 'preview-camera-invalid' });
      }
      state.installedGenerationId = result.generationId;
      pendingRenderTimingsRef.current = {
        generationId: result.generationId,
        meshSetupMs: performance.now() - meshSetupStartedAt,
      };
      state.invalidate?.();
    } catch (cause) {
      state.fail(
        cause instanceof RecoveryError ? cause.failure.code : 'preview-render-failed',
        cause instanceof Error ? cause.message : undefined,
      );
    }
  }, [result, templateId, restartKey]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !appearance) return;
    const base = state.group.children[0];
    const relief = state.group.children[1];
    if (base instanceof THREE.Mesh) {
      (base.material as THREE.MeshStandardMaterial).color.set(appearance.base.color);
    }
    if (relief instanceof THREE.Mesh) {
      (relief.material as THREE.MeshStandardMaterial).color.set(appearance.relief.color);
    }
    state.invalidate?.();
  }, [appearance, restartKey]);

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
        floor: boolean;
        platformColor: string;
      }
    > = {
      matte: {
        background: '#eee8df',
        roughness: 0.92,
        metalness: 0,
        grid: false,
        platform: false,
        floor: false,
        platformColor: '#a87850',
      },
      graph: {
        background: '#e7e4de',
        roughness: 0.86,
        metalness: 0,
        grid: true,
        platform: false,
        floor: false,
        platformColor: '#a87850',
      },
      dark: {
        background: '#202735',
        roughness: 0.8,
        metalness: 0.05,
        grid: false,
        platform: false,
        floor: false,
        platformColor: '#555b65',
      },
      wood: {
        background: '#ded5c8',
        roughness: 0.72,
        metalness: 0,
        grid: false,
        platform: true,
        floor: true,
        platformColor: '#e3d3b7',
      },
      metal: {
        background: '#c7cdd1',
        roughness: 0.44,
        metalness: 0.68,
        grid: false,
        platform: true,
        floor: true,
        platformColor: '#d5dadd',
      },
    };
    const preset = presets[surfacePreset];
    const texturedBoard = surfacePreset === 'wood' || surfacePreset === 'metal';

    if (texturedBoard) {
      state.surfaceMaterials ??= createSurfaceMaterials();
      state.platform.material =
        surfacePreset === 'wood' ? state.surfaceMaterials.oak : state.surfaceMaterials.metal;
    } else {
      state.platform.material = state.platformBaseMaterial;
    }

    state.scene.background = new THREE.Color(preset.background);
    floorMaterial.color.set(preset.background);
    floorMaterial.roughness = preset.roughness;
    floorMaterial.metalness = preset.metalness;
    state.grid.visible = preset.grid;
    state.floor.visible = preset.floor;
    state.platform.visible = preset.platform;
    const platformMaterial = state.platform.material as THREE.MeshStandardMaterial;

    platformMaterial.color.set(preset.platformColor);
    if (!texturedBoard) {
      platformMaterial.roughness = preset.roughness;
      platformMaterial.metalness = preset.metalness;
    }
    const current = resultRef.current;

    state.displayOffsetZ = preset.platform ? BOARD_DISPLAY_OFFSET : 0;
    state.group.position.z = state.displayOffsetZ;
    if (current) {
      const center = new THREE.Vector3(...current.dimensions.centerMm);

      state.floor.position.set(center.x, center.y, preset.platform ? -BOARD_DISPLAY_OFFSET : -0.08);
      state.grid.position.set(
        center.x,
        center.y,
        preset.platform ? -BOARD_DISPLAY_OFFSET + 0.02 : -0.06,
      );
      syncPlatform(state, current);
      fitViewer(state, current, activeViewRef.current, false, (zoom, pan) => {
        setInspectionZoom(zoom);
        setInspectionPan(pan);
      });
    }
    state.invalidate?.();
  }, [surfacePreset, restartKey]);
  return (
    <div
      className={`${styles.root} viewer`}
      role="region"
      aria-label={t(locale, 'livePreview')}
      data-view={activeView}
      data-zoom-scale={inspectionZoom.toFixed(3)}
      data-surface={surfacePreset}
      data-board-material={
        surfacePreset === 'wood' ? 'oak' : surfacePreset === 'metal' ? 'brushed-metal' : 'none'
      }
      data-render-mode="on-demand"
      data-preview-capability={previewCapability}
    >
      <div
        className="viewer-surface"
        ref={hostRef}
        tabIndex={0}
        role="group"
        aria-label={t(
          locale,
          previewCapability === 'unavailable' ? 'previewUnavailableTitle' : 'viewerInstructions',
        )}
        onKeyDown={(event) => {
          if (previewCapability === 'unavailable') return;
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoomBy(INSPECTION_ZOOM_STEP);
          } else if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            zoomBy(1 / INSPECTION_ZOOM_STEP);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            panBy(-0.08, 0);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            panBy(0.08, 0);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            panBy(0, 0.08);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            panBy(0, -0.08);
          } else if (event.key.toLowerCase() === 'f') {
            event.preventDefault();
            resetInspection(false);
          }
        }}
      >
        {previewCapability === 'unavailable' ? (
          <div className="viewer-unavailable">
            <span className="viewer-unavailable-icon" aria-hidden="true">
              !
            </span>
            <RecoveryNotice
              role="alert"
              message={recoveryMessage(locale, previewFailure ?? { code: 'preview-unavailable' })}
              steps={recoverySteps(locale, previewFailure ?? { code: 'preview-unavailable' })}
              detailsLabel={t(locale, 'recoveryDetails')}
              diagnostic={previewFailure?.message}
              actions={
                onRetry
                  ? [
                      { id: 'retry-preview', label: t(locale, 'recoveryRetry'), onAction: onRetry },
                      {
                        id: 'reload',
                        label: t(locale, 'recoveryReload'),
                        onAction: () => window.location.reload(),
                      },
                    ]
                  : []
              }
            />
          </div>
        ) : (
          <p className="viewer-caption">{t(locale, 'dragRotate')}</p>
        )}
      </div>
      <div className="viewer-toolbar" role="group" aria-label={t(locale, 'previewCameraControls')}>
        <div className="viewer-toolbar-controls">
          {VIEW_DEFINITIONS.map((view) => (
            <button
              type="button"
              key={view.id}
              className={activeView === view.id ? 'active' : ''}
              aria-label={t(locale, view.id === 'home' ? 'home' : view.id)}
              aria-pressed={activeView === view.id}
              title={t(locale, view.id === 'home' ? 'home' : view.id)}
              disabled={previewCapability === 'unavailable'}
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
            disabled={previewCapability === 'unavailable'}
            onClick={() => zoomBy(1 / INSPECTION_ZOOM_STEP)}
          >
            <ZoomOut aria-hidden="true" focusable="false" size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={t(locale, 'zoomIn')}
            title={t(locale, 'zoomIn')}
            disabled={previewCapability === 'unavailable'}
            onClick={() => zoomBy(INSPECTION_ZOOM_STEP)}
          >
            <ZoomIn aria-hidden="true" focusable="false" size={18} strokeWidth={2} />
          </button>
          <span className="viewer-zoom-readout" aria-live="polite">
            {Math.round(inspectionZoom * 100)}%
          </span>
          <button
            type="button"
            aria-label={t(locale, 'fitView')}
            title={t(locale, 'fitView')}
            disabled={previewCapability === 'unavailable'}
            onClick={() => resetInspection(false)}
          >
            <Maximize2 aria-hidden="true" focusable="false" size={18} strokeWidth={2} />
          </button>
        </div>
        {toolbarAction && <div className="viewer-toolbar-photo">{toolbarAction}</div>}
      </div>
    </div>
  );
};
