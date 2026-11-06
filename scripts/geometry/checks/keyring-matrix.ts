/**
 * Build every keyring-capable template and style at every keyring position and check that the
 * result is printable with a clear opening. Run with `pnpm test:geometry:keyring [mode] [filter]`.
 *
 * Modes: `base` (all opening presets), `offset` (±3 mm hole offset), `texts` (short, long, narrow,
 * wide and Cyrillic names), `subtitle`, `fonts` (every articulated font), or `all` (default).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildKeychain, createWasm } from '../../../src/domain/keychain/build/keychain-builder';
import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
} from '../../../src/domain/keychain/fonts/catalog';
import { KEYRING_POSITIONS } from '../../../src/domain/keychain/model/keyring-position';
import {
  KEYRING_PRESETS,
  keyringPresetValues,
} from '../../../src/domain/keychain/model/keyring-presets';
import { DEFAULT_PARAMS, type KeychainParams } from '../../../src/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '../../../src/domain/keychain/templates/template-builder';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MODES = ['base', 'offset', 'texts', 'subtitle', 'fonts'] as const;
type Mode = (typeof MODES)[number];
const TEXTS = ['A', 'MAXIMILIAN', 'IIII', 'WWWW', 'НИКИТА', 'iJj', 'Lo', 'TOM'];

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith('/fonts/'))
    return new Response(Uint8Array.from(await readFile(path.join(ROOT, 'public', url))));
  return originalFetch(input);
}) as typeof fetch;

type Case = { id: string; params: Partial<KeychainParams> };

const casesFor = (mode: Mode): Case[] => {
  const cases: Case[] = [];
  for (const template of TEMPLATE_CATALOG.filter((item) => item.supportsKeyring)) {
    const styles = template.styles.length ? template.styles : (['contour'] as const);
    const articulated = template.id === 'articulated-name';
    for (const styleId of styles) {
      const base: Partial<KeychainParams> = {
        templateId: template.id,
        styleId,
        fontId: articulated ? 'bungee' : DEFAULT_PARAMS.fontId,
        subtitle: styleId === 'heart-split' ? 'SAM' : '',
      };
      const prefix = articulated ? template.id : `${template.id}/${styleId}`;
      for (const keyringPosition of KEYRING_POSITIONS) {
        const at = { ...base, keyringPosition };
        if (mode === 'base')
          for (const preset of KEYRING_PRESETS)
            cases.push({
              id: `${prefix}/${keyringPosition}/${preset.id}`,
              params: { ...at, text: 'ALEX', ...keyringPresetValues(preset.id) },
            });
        if (mode === 'offset' && template.id !== 'articulated-name')
          for (const ringOffsetMm of [-3, 3])
            for (const preset of ['standard-round', 'large-round', 'oval-slot'] as const)
              cases.push({
                id: `${prefix}/${keyringPosition}/${preset}/offset${ringOffsetMm}`,
                params: { ...at, text: 'ALEX', ringOffsetMm, ...keyringPresetValues(preset) },
              });
        if (mode === 'offset' && articulated)
          for (const ringOffsetMm of [-3, 3])
            cases.push({
              id: `${prefix}/${keyringPosition}/offset${ringOffsetMm}`,
              params: { ...at, text: 'ALEX', ringOffsetMm },
            });
        if (mode === 'texts')
          for (const text of TEXTS) {
            const font = FONT_CATALOG.find((item) =>
              articulated ? fontSupportsArticulatedName(item, text) : fontSupportsText(item, text),
            );
            if (!font || (articulated && [...text].length < 2)) continue;
            cases.push({
              id: `${prefix}/${keyringPosition}/${text}`,
              params: { ...at, text, fontId: font.id },
            });
          }
        if (mode === 'subtitle' && !articulated && styleId !== 'heart-split')
          cases.push({
            id: `${prefix}/${keyringPosition}/subtitle`,
            params: { ...at, text: 'ALEX', subtitle: 'BEST FRIEND' },
          });
        if (mode === 'fonts' && articulated)
          for (const font of FONT_CATALOG.filter((item) => item.supportsArticulated))
            for (const text of ['ALEX', 'NIKITA', 'IIII', 'Mo'])
              if (fontSupportsArticulatedName(font, text))
                cases.push({
                  id: `${prefix}/${font.id}/${keyringPosition}/${text}`,
                  params: { ...at, text, fontId: font.id },
                });
      }
    }
  }
  return cases;
};

const requested = process.argv[2] ?? 'all';
const filter = process.argv[3];
if (requested !== 'all' && !MODES.includes(requested as Mode))
  throw new Error(`Unknown mode ${requested}; use one of all, ${MODES.join(', ')}.`);
const modes = requested === 'all' ? MODES : [requested as Mode];
const cases = modes.flatMap(casesFor).filter((item) => !filter || item.id.includes(filter));

const wasm = await createWasm();
const failures: string[] = [];
const started = performance.now();
for (const [index, item] of cases.entries()) {
  try {
    const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, ...item.params });
    const errors = result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.code);
    if (!result.printable || !result.keyring) failures.push(`${item.id}: ${errors.join(', ')}`);
  } catch (error) {
    failures.push(`${item.id}: threw ${(error as Error).message}`);
  }
  if ((index + 1) % 50 === 0) console.log(`${index + 1}/${cases.length}`);
}
console.log(
  `${cases.length} keyring cases, ${failures.length} failures in ${Math.round((performance.now() - started) / 1000)} s`,
);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length) process.exitCode = 1;
