import { access, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/**
 * Responsive AVIF/WebP derivatives of the showcase PNGs under `public/showcase/v1/`.
 *
 * `/showcase/v1/*` is served `immutable`, so an existing derivative is never rewritten: a changed
 * source needs a new version directory, not new bytes under an old URL. `--check` fails when a
 * derivative is missing.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicDirectory = resolve(root, 'public');
/** Design cards are about 120–260 CSS px wide and crop 16:9 renders to cover them. */
const CARD_WIDTHS = [240, 480, 720];

const cardSources = async (directory) =>
  (await readdir(resolve(publicDirectory, 'showcase', directory)))
    .filter((file) => file.endsWith('.png') && !file.endsWith('-mobile.png'))
    .map((file) => ({
      input: `showcase/${directory}/${file}`,
      output: `showcase/v1/cards/${directory}/${file.replace(/\.png$/, '')}`,
      widths: CARD_WIDTHS,
    }));

const assets = [
  {
    input: 'showcase/create-desktop.png',
    output: 'showcase/v1/create-desktop',
    widths: [720, 1440],
  },
  {
    input: 'showcase/create-mobile.png',
    output: 'showcase/v1/create-mobile',
    widths: [390, 490, 780],
  },
  ...['name-keychain', 'articulated-name', 'nameplate', 'plant-label', 'magnet'].map((name) => ({
    input: `showcase/templates/${name}.png`,
    output: `showcase/v1/templates/${name}`,
    widths: [320, 640],
  })),
  ...['example_1', 'example_1-en', 'example_2', 'example_2-en'].map((name) => ({
    input: `showcase/prints/${name}.png`,
    output: `showcase/v1/prints/${name}`,
    widths: [627, 1254],
  })),
  ...(await cardSources('templates')),
  ...(await cardSources('styles')),
];

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

const generateVariant = async (asset, width, format) => {
  const output = resolve(publicDirectory, `${asset.output}-${width}.${format}`);
  if (await exists(output)) return undefined;
  if (process.argv.includes('--check')) return output;
  await mkdir(dirname(output), { recursive: true });
  const source =
    asset.input === 'showcase/create-mobile.png' && width > 390
      ? 'showcase/create-mobile@2x.png'
      : asset.input;
  const image = sharp(resolve(publicDirectory, source)).resize({
    width,
    withoutEnlargement: true,
  });

  if (format === 'avif') {
    await image.avif({ quality: 45, effort: 4 }).toFile(output);
  } else {
    await image.webp({ quality: 75, effort: 4 }).toFile(output);
  }
  return output;
};

const written = (
  await Promise.all(
    assets.flatMap((asset) =>
      asset.widths.flatMap((width) =>
        ['avif', 'webp'].map((format) => generateVariant(asset, width, format)),
      ),
    ),
  )
).filter(Boolean);

if (process.argv.includes('--check')) {
  if (written.length) {
    process.stderr.write(
      `Missing showcase derivatives (run \`pnpm assets:landing\`):\n${written.join('\n')}\n`,
    );
    process.exitCode = 1;
  }
} else {
  process.stdout.write(`wrote ${written.length} showcase derivatives\n`);
}
