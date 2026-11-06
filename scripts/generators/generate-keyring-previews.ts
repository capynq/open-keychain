import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

/**
 * Generate the keyring position picker artwork from the real geometry builder.
 *
 * Every template and style that carries a keyring is built once per opening preset and position for
 * the fixed sample name "ALEX". The picker draws the ring-less body, the raised letters and, for
 * each preset and position, the actual tab and opening centre, so its markers sit exactly where the
 * builder puts the ring and the drawn tab matches the opening the user chose.
 */
import type { CrossSection, GeometryWasm } from '../../src/infrastructure/geometry/manifold-types';

import { buildKeychain, createWasm } from '../../src/domain/keychain/build/keychain-builder';
import { articulatedFallbackFont } from '../../src/domain/keychain/fonts/catalog';
import {
  KEYRING_POSITIONS,
  type KeyringPosition,
} from '../../src/domain/keychain/model/keyring-position';
import {
  KEYRING_PRESETS,
  keyringPresetValues,
  type KeyringPreset,
} from '../../src/domain/keychain/model/keyring-presets';
import {
  DEFAULT_PARAMS,
  type KeychainParams,
  type MeshBuffer,
} from '../../src/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '../../src/domain/keychain/templates/template-builder';
import { manifoldFromMesh, MANIFOLD_SCALE } from '../../src/infrastructure/geometry/manifold-utils';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT = path.join(ROOT, 'src/features/customizer/model/keyring-preview-artwork.ts');
const SAMPLE_TEXT = 'ALEX';
/** Outline simplification in scaled units: 0.08 mm keeps letter shapes, drops tessellation noise. */
const SIMPLIFY = 80;

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith('/fonts/'))
    return new Response(Uint8Array.from(await readFile(path.join(ROOT, 'public', url))));
  return originalFetch(input);
}) as typeof fetch;

type Vec2 = [number, number];
const round = (value: number): number => Math.round(value * 10) / 10;
/** Tenths of a millimetre as the shortest SVG number: 0.3 → ".3", -0.3 → "-.3". */
const formatTenths = (tenths: number): string =>
  (tenths / 10).toString().replace(/^(-?)0\./, '$1.');

/**
 * SVG path in millimetres with y pointing down; holes rely on the even-odd fill rule. Points after
 * the first are relative and rounded to 0.1 mm before differencing, so nothing drifts and the
 * shipped artwork stays small.
 */
const svgPath = (section: CrossSection): string =>
  (section.toPolygons() as Vec2[][])
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => {
      const points = polygon.map(([x, y]): Vec2 => [
        Math.round((x / MANIFOLD_SCALE) * 10),
        Math.round((-y / MANIFOLD_SCALE) * 10),
      ]);
      const [first] = points;
      const steps: string[] = [];
      for (let index = 1; index < points.length; index += 1) {
        const dx = points[index][0] - points[index - 1][0];
        const dy = points[index][1] - points[index - 1][1];
        if (dx || dy) steps.push(`${formatTenths(dx)} ${formatTenths(dy)}`);
      }
      return `M${formatTenths(first[0])} ${formatTenths(first[1])}l${steps.join(' ')}z`;
    })
    .join('');

const silhouette = (wasm: GeometryWasm, mesh: MeshBuffer): CrossSection => {
  const solid = manifoldFromMesh(wasm, mesh);
  try {
    const projected = solid.project();
    try {
      return projected.simplify(SIMPLIFY);
    } finally {
      projected.delete();
    }
  } finally {
    solid.delete();
  }
};

const centerOf = (section: CrossSection): Vec2 => {
  const bounds = section.bounds();
  return [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2];
};

/** Raised letters left to right; articulated names produce one cap per letter. */
const letterCenters = (relief: CrossSection): Vec2[] => {
  const components = relief.decompose();
  try {
    return components.map(centerOf).sort((left, right) => left[0] - right[0]);
  } finally {
    components.forEach((component) => component.delete());
  }
};

class FittedWidthError extends Error {}
type PresetId = KeyringPreset['id'];
/** The preset whose left and right builds define the shared body and letters. */
const REFERENCE_PRESET: PresetId = 'standard-round';
type PositionBuild = {
  preset: PresetId;
  position: KeyringPosition;
  body: CrossSection;
  relief: CrossSection;
  center: Vec2;
  hostIndex?: number;
};

const previewParams = (
  templateId: KeychainParams['templateId'],
  styleId: KeychainParams['styleId'],
  preset: PresetId,
  position: KeyringPosition,
  textSizeMm: number,
): KeychainParams => ({
  ...DEFAULT_PARAMS,
  ...keyringPresetValues(preset),
  templateId,
  styleId,
  text: SAMPLE_TEXT,
  textSizeMm,
  fontId:
    templateId === 'articulated-name'
      ? articulatedFallbackFont(SAMPLE_TEXT).id
      : DEFAULT_PARAMS.fontId,
  baseThicknessMm: templateId === 'articulated-name' ? 3.4 : DEFAULT_PARAMS.baseThicknessMm,
  keyringPosition: position,
});

const buildPosition = async (
  wasm: GeometryWasm,
  preset: PresetId,
  params: KeychainParams,
): Promise<PositionBuild> => {
  const { result } = await buildKeychain(wasm, params);
  const position = params.keyringPosition ?? 'left';
  if (!result.printable || !result.keyring)
    throw new Error(
      `${params.templateId}/${params.styleId}/${preset}/${position} is not printable: ${JSON.stringify(result.issues)}`,
    );
  /* Width fitting rescales each position differently, which would misalign the shared body. */
  if (result.issues.some((issue) => ['scaled-to-fit', 'text-over-width'].includes(issue.code)))
    throw new FittedWidthError();
  return {
    preset,
    position,
    body: silhouette(wasm, result.baseMesh),
    relief: silhouette(wasm, result.reliefMesh),
    center: [
      result.keyring.centerMm[0] * MANIFOLD_SCALE,
      result.keyring.centerMm[1] * MANIFOLD_SCALE,
    ],
    hostIndex: result.keyring.hostIndex,
  };
};

type PreviewRecord = {
  key: string;
  bounds: [number, number, number, number];
  body: string;
  relief: string;
  openings: Record<PresetId, Record<KeyringPosition, { center: Vec2; tab: string }>>;
};

const generatePreview = async (
  wasm: GeometryWasm,
  templateId: KeychainParams['templateId'],
  styleId: KeychainParams['styleId'],
): Promise<PreviewRecord> => {
  let builds: PositionBuild[] = [];
  for (let textSizeMm = DEFAULT_PARAMS.textSizeMm; ; textSizeMm -= 1) {
    if (textSizeMm < 12) throw new Error(`${templateId}/${styleId} does not fit without scaling`);
    builds.forEach((build) => [build.body, build.relief].forEach((item) => item.delete()));
    builds = [];
    try {
      for (const { id: preset } of KEYRING_PRESETS)
        for (const position of KEYRING_POSITIONS)
          builds.push(
            await buildPosition(
              wasm,
              preset,
              previewParams(templateId, styleId, preset, position, textSizeMm),
            ),
          );
      break;
    } catch (error) {
      if (!(error instanceof FittedWidthError)) throw error;
    }
  }
  const owned: CrossSection[] = builds.flatMap((build) => [build.body, build.relief]);
  try {
    /*
     * Articulated names re-space their letters around the ring, so align every build on the letter
     * that carries it. Standard builds share one frame and need no shift.
     */
    const referenceBuild = (position: KeyringPosition): PositionBuild =>
      builds.find((build) => build.preset === REFERENCE_PRESET && build.position === position)!;
    const reference = referenceBuild('left');
    const referenceLetters = letterCenters(reference.relief);
    const shiftFor = (build: PositionBuild): Vec2 => {
      if (build.hostIndex === undefined) return [0, 0];
      const letters = letterCenters(build.relief);
      const own = letters[build.hostIndex];
      const target = referenceLetters[build.hostIndex];
      return own && target ? [target[0] - own[0], target[1] - own[1]] : [0, 0];
    };
    const aligned = builds.map((build) => {
      const shift = shiftFor(build);
      const body = build.body.translate(shift);
      owned.push(body);
      return {
        preset: build.preset,
        position: build.position,
        body,
        center: [build.center[0] + shift[0], build.center[1] + shift[1]] as Vec2,
      };
    });
    const alignedReference = (position: KeyringPosition) =>
      aligned.find((build) => build.preset === REFERENCE_PRESET && build.position === position)!;
    const left = alignedReference('left');
    const right = alignedReference('right');
    const body = left.body.intersect(right.body).simplify(SIMPLIFY);
    owned.push(body);
    const grown = body.offset(150, 'Round', 2, 32);
    owned.push(grown);
    const openings = Object.fromEntries(
      KEYRING_PRESETS.map((preset) => [preset.id, {}]),
    ) as PreviewRecord['openings'];
    let minX = body.bounds().min[0];
    let minY = body.bounds().min[1];
    let maxX = body.bounds().max[0];
    let maxY = body.bounds().max[1];
    for (const build of aligned) {
      /* Keep only the tab that holds this opening; letter re-spacing leaves thin slivers elsewhere. */
      const difference = build.body.subtract(grown);
      owned.push(difference);
      const components = difference.decompose();
      owned.push(...components);
      const containsCenter = (component: CrossSection): boolean => {
        const bounds = component.bounds();
        return (
          bounds.min[0] <= build.center[0] &&
          build.center[0] <= bounds.max[0] &&
          bounds.min[1] <= build.center[1] &&
          build.center[1] <= bounds.max[1]
        );
      };
      const tab = components.filter(containsCenter);
      if (!tab.length)
        throw new Error(
          `No keyring tab found for ${templateId}/${styleId}/${build.preset}/${build.position}`,
        );
      const tabSection = tab.length === 1 ? tab[0] : wasm.CrossSection.union(tab);
      if (tab.length > 1) owned.push(tabSection);
      const tabBounds = tabSection.bounds();
      minX = Math.min(minX, tabBounds.min[0]);
      minY = Math.min(minY, tabBounds.min[1]);
      maxX = Math.max(maxX, tabBounds.max[0]);
      maxY = Math.max(maxY, tabBounds.max[1]);
      openings[build.preset][build.position] = {
        center: [round(build.center[0] / MANIFOLD_SCALE), round(-build.center[1] / MANIFOLD_SCALE)],
        tab: svgPath(tabSection),
      };
    }
    return {
      key: templateId === 'articulated-name' ? templateId : `${templateId}/${styleId}`,
      bounds: [
        round(minX / MANIFOLD_SCALE),
        round(-maxY / MANIFOLD_SCALE),
        round((maxX - minX) / MANIFOLD_SCALE),
        round((maxY - minY) / MANIFOLD_SCALE),
      ],
      body: svgPath(body),
      relief: svgPath(reference.relief),
      openings,
    };
  } finally {
    new Set(owned).forEach((section) => section.delete());
  }
};

const wasm = await createWasm();
const records: PreviewRecord[] = [];
for (const template of TEMPLATE_CATALOG.filter((item) => item.supportsKeyring)) {
  const styles = template.styles.length ? template.styles : (['contour'] as const);
  for (const styleId of styles) {
    records.push(await generatePreview(wasm, template.id, styleId));
    console.log(`generated ${records.at(-1)!.key}`);
  }
}

const draft = `/* Generated by scripts/generators/generate-keyring-previews.ts. Do not edit by hand. */
import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeyringPresetId } from '@/domain/keychain/model/keyring-presets';

export type KeyringPreviewPreset = Exclude<KeyringPresetId, 'custom'>;

export type KeyringPreviewOpening = {
  /** Opening centre in millimetres. */
  center: readonly [number, number];
  /** Tab outline with its opening, even-odd filled. */
  tab: string;
};

export type KeyringPreviewArtwork = {
  /** SVG viewBox in millimetres (x, y, width, height); y points down. Covers every preset. */
  bounds: readonly [number, number, number, number];
  /** Ring-less backing silhouette, even-odd filled. */
  body: string;
  /** Raised letters. */
  relief: string;
  /** The tab the builder attaches for each opening preset and position. */
  openings: Readonly<
    Record<KeyringPreviewPreset, Readonly<Record<KeyringPosition, KeyringPreviewOpening>>>
  >;
};

export const KEYRING_PREVIEW_SAMPLE_TEXT = ${JSON.stringify(SAMPLE_TEXT)};

export const KEYRING_PREVIEW_ARTWORK: Readonly<Record<string, KeyringPreviewArtwork>> = {
${records
  .map(
    (record) => `  ${JSON.stringify(record.key)}: {
    bounds: ${JSON.stringify(record.bounds)},
    body: ${JSON.stringify(record.body)},
    relief: ${JSON.stringify(record.relief)},
    openings: {
${KEYRING_PRESETS.map(
  ({ id: preset }) => `      ${JSON.stringify(preset)}: {
${KEYRING_POSITIONS.map(
  (position) =>
    `        ${JSON.stringify(position)}: { center: ${JSON.stringify(record.openings[preset][position].center)}, tab: ${JSON.stringify(record.openings[preset][position].tab)} },`,
).join('\n')}
      },`,
).join('\n')}
    },
  },`,
  )
  .join('\n')}
};
`;

const source = await prettier.format(draft, {
  ...(await prettier.resolveConfig(OUTPUT)),
  filepath: OUTPUT,
});

if (process.argv.includes('--check')) {
  const current = await readFile(OUTPUT, 'utf8').catch(() => '');
  if (current !== source) {
    console.error(
      'Keyring preview artwork is out of date. Run `pnpm assets:keyring-previews` to regenerate it.',
    );
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT, source, 'utf8');
  console.log(`wrote ${path.relative(ROOT, OUTPUT)} (${Math.round(source.length / 1024)} KB)`);
}
