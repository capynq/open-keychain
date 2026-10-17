import * as THREE from 'three';

const seededRandom = (seed: number): (() => number) => {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const createOakCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  canvas.width = 1024;
  canvas.height = 512;
  const random = seededRandom(1817);
  const base = context.createLinearGradient(0, 0, 0, canvas.height);

  base.addColorStop(0, '#b48a57');
  base.addColorStop(0.2, '#c9a872');
  base.addColorStop(0.52, '#ad8250');
  base.addColorStop(0.78, '#c49c64');
  base.addColorStop(1, '#a77b4c');
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 760; index += 1) {
    const startY = random() * canvas.height;
    const amplitude = 0.3 + random() * 2.4;
    const frequency = 0.004 + random() * 0.035;
    const phase = random() * Math.PI * 2;
    const light = random() > 0.53;

    context.beginPath();
    context.moveTo(0, startY);
    for (let x = 32; x <= canvas.width; x += 32) {
      const drift = Math.sin(x * frequency + phase) * amplitude;
      const longWave = Math.sin(x * 0.007 + phase * 0.3) * amplitude * 0.55;

      context.lineTo(x, startY + drift + longWave);
    }
    context.strokeStyle = light ? '#e3c58f' : '#684524';
    context.globalAlpha = 0.025 + random() * 0.09;
    context.lineWidth = 0.25 + random() * 1.15;
    context.stroke();
  }
  context.globalAlpha = 1;

  for (let index = 0; index < 5; index += 1) {
    const x = 90 + random() * 840;
    const y = 35 + random() * 440;
    const radiusX = 12 + random() * 20;
    const radiusY = 3 + random() * 5;

    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 0.22);
    for (let ring = 0; ring < 4; ring += 1) {
      context.beginPath();
      context.ellipse(
        0,
        0,
        radiusX * (0.35 + ring * 0.2),
        radiusY * (0.35 + ring * 0.2),
        0,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = ring % 2 ? '#d5b27c' : '#684524';
      context.globalAlpha = 0.08;
      context.lineWidth = 1;
      context.stroke();
    }
    context.restore();
  }
  context.globalAlpha = 1;
  return canvas;
};

const createBrushedMetalCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  canvas.width = 1024;
  canvas.height = 512;
  const random = seededRandom(4529);
  const base = context.createLinearGradient(0, 0, 0, canvas.height);

  base.addColorStop(0, '#aab2b8');
  base.addColorStop(0.24, '#c6ccd0');
  base.addColorStop(0.55, '#9ca5ac');
  base.addColorStop(0.8, '#bdc4c8');
  base.addColorStop(1, '#858f97');
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 2200; index += 1) {
    const y = random() * canvas.height;
    const x = random() * canvas.width;
    const length = 35 + random() * 420;

    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(canvas.width, x + length), y + (random() - 0.5) * 0.6);
    context.strokeStyle = random() > 0.5 ? '#e1e5e7' : '#3d474e';
    context.globalAlpha = 0.025 + random() * 0.11;
    context.lineWidth = 0.2 + random() * 0.75;
    context.stroke();
  }
  context.globalAlpha = 1;
  return canvas;
};

const textureFromCanvas = (canvas: HTMLCanvasElement, color: boolean): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export type SurfaceMaterials = {
  oak: THREE.MeshStandardMaterial;
  metal: THREE.MeshPhysicalMaterial;
  dispose: () => void;
};

export const createSurfaceMaterials = (): SurfaceMaterials => {
  const oakCanvas = createOakCanvas();
  const metalCanvas = createBrushedMetalCanvas();
  const oakMap = textureFromCanvas(oakCanvas, true);
  const oakBump = textureFromCanvas(oakCanvas, false);
  const metalMap = textureFromCanvas(metalCanvas, true);
  const metalBump = textureFromCanvas(metalCanvas, false);
  const oak = new THREE.MeshStandardMaterial({
    color: '#e3d3b7',
    map: oakMap,
    bumpMap: oakBump,
    bumpScale: 0.22,
    roughness: 0.72,
    metalness: 0,
  });
  const metal = new THREE.MeshPhysicalMaterial({
    color: '#d5dadd',
    map: metalMap,
    bumpMap: metalBump,
    bumpScale: 0.045,
    roughness: 0.44,
    metalness: 0.68,
    anisotropy: 0.36,
  });

  return {
    oak,
    metal,
    dispose: () => {
      oak.dispose();
      oakMap.dispose();
      oakBump.dispose();
      metal.dispose();
      metalMap.dispose();
      metalBump.dispose();
    },
  };
};
