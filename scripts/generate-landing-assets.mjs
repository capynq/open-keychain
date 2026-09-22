import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = resolve(root, 'public');

const assets = [
  {
    input: 'showcase/create-desktop.png',
    output: 'showcase/v1/create-desktop',
    widths: [720, 1440],
  },
  {
    input: 'showcase/create-mobile.png',
    output: 'showcase/v1/create-mobile',
    widths: [390, 780],
  },
  ...['name-keychain', 'articulated-name', 'nameplate', 'plant-label'].map((name) => ({
    input: `showcase/templates/${name}.png`,
    output: `showcase/v1/templates/${name}`,
    widths: [320, 640],
  })),
  ...['example_1', 'example_1-en', 'example_2', 'example_2-en'].map((name) => ({
    input: `showcase/prints/${name}.png`,
    output: `showcase/v1/prints/${name}`,
    widths: [627, 1254],
  })),
];

const generateVariant = async (asset, width, format) => {
  const output = resolve(publicDirectory, `${asset.output}-${width}.${format}`);
  await mkdir(dirname(output), { recursive: true });
  const image = sharp(resolve(publicDirectory, asset.input)).resize({
    width,
    withoutEnlargement: true,
  });

  if (format === 'avif') {
    await image.avif({ quality: 45, effort: 4 }).toFile(output);
  } else {
    await image.webp({ quality: 75, effort: 4 }).toFile(output);
  }
};

await Promise.all(
  assets.flatMap((asset) =>
    asset.widths.flatMap((width) =>
      ['avif', 'webp'].map((format) => generateVariant(asset, width, format)),
    ),
  ),
);
