import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const publicAsset = (path: string) =>
  fileURLToPath(new URL(`../../../../public/${path}`, import.meta.url));

const assets = [
  ['showcase/v1/create-desktop-720.avif', 'avif', 720],
  ['showcase/v1/create-desktop-1440.webp', 'webp', 1440],
  ['showcase/v1/create-mobile-390.avif', 'avif', 390],
  ['showcase/v1/create-mobile-490.avif', 'avif', 490],
  ['showcase/v1/create-mobile-490.webp', 'webp', 490],
  ['showcase/v1/create-mobile-780.webp', 'webp', 780],
  ['showcase/v1/templates/name-keychain-320.avif', 'avif', 320],
  ['showcase/v1/templates/name-keychain-640.webp', 'webp', 640],
  ['showcase/v1/prints/example_1-en-627.avif', 'avif', 627],
  ['showcase/v1/prints/example_1-en-1254.webp', 'webp', 1254],
] as const;

describe('landing image derivatives', () => {
  it('keeps versioned modern formats at their responsive source widths', async () => {
    await Promise.all(
      assets.map(async ([path, format, width]) => {
        const source = publicAsset(path);

        await access(source);

        const metadata = await sharp(source).metadata();

        expect(metadata.format).toBe(format === 'avif' ? 'heif' : format);
        expect(metadata.width).toBe(width);
        expect(metadata.height).toBeGreaterThan(0);
      }),
    );
  });

  it('retains legacy PNG fallbacks and the versioned WASM artifact', async () => {
    await Promise.all(
      [
        'showcase/create-desktop.png',
        'showcase/create-mobile.png',
        'showcase/prints/example_1-en.png',
        'showcase/templates/name-keychain.png',
        'manifold.wasm',
        'manifold-v1.wasm',
      ].map((path) => access(publicAsset(path))),
    );
  });
});
