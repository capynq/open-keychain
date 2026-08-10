import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildKeychain, createWasm } from '../src/domain/keychain/build/keychain-builder';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  if (url.startsWith('/fonts/')) {
    const file = await fs.readFile(path.join(process.cwd(), 'public', url));
    const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    return new Response(body);
  }
  return originalFetch(input);
}) as typeof fetch;
const wasm = await createWasm();
for (const text of ['A', 'LI', 'ALEX', 'OLIVER', 'CHARLOTTE', 'MAXIMILIAN', 'iJj', 'ÉMILIE']) {
  const start = performance.now();
  const { result } = await buildKeychain(wasm, { ...DEFAULT_PARAMS, text });
  console.log(
    JSON.stringify({
      text,
      ms: Number((performance.now() - start).toFixed(1)),
      printable: result.printable,
      triangles: result.baseMesh.indices.length / 3,
      dimensions: result.dimensions,
      issues: result.issues,
    }),
  );
}
