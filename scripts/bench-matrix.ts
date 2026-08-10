import fs from 'node:fs/promises';
import path from 'node:path';
import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import { FONT_CATALOG, fontSupportsText } from '../src/domain/keychain/fonts/catalog';
import { STYLE_CATALOG } from '../src/domain/keychain/styles/style-builder';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  if (url.startsWith('/fonts/')) {
    const file = await fs.readFile(path.join(process.cwd(), 'public', url));
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return new Response(body);
  }
  return originalFetch(input);
}) as typeof fetch;
const wasm = await createWasm();
const names = [
  'ALEX',
  'OLIVER',
  'OBO',
  'iJj',
  'ÉMILIE',
  'NIKITA',
  'NIKITAA',
  'IIIIIIII',
  'НИКИТА',
  'Привет',
];
let passed = 0;
let failed = 0;
const triangleCounts = new Map<string, number>();
for (const font of FONT_CATALOG)
  for (const style of STYLE_CATALOG)
    for (const text of names) {
      if (!fontSupportsText(font, text)) continue;
      const { result, exportMesh } = await buildKeychain(
        wasm,
        { ...DEFAULT_PARAMS, fontId: font.id, styleId: style.id, text },
        true,
      );
      const triangles = (exportMesh?.indices.length ?? 0) / 3;
      const key = `${font.id}/${style.id}`;
      triangleCounts.set(key, Math.max(triangleCounts.get(key) ?? 0, triangles));
      const densityCovered =
        triangles <= 12000 || result.issues.some((issue) => issue.code === 'dense-mesh');
      if (result.printable && densityCovered) passed += 1;
      else {
        failed += 1;
        console.error(
          JSON.stringify({
            font: font.name,
            style: style.name,
            text,
            triangles,
            issues: result.issues,
          }),
        );
      }
    }
console.log(
  JSON.stringify({
    cases: passed + failed,
    passed,
    failed,
    maximumTriangles: Object.fromEntries(triangleCounts),
  }),
);
if (failed) process.exitCode = 1;
