import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/* The parser chunk fails to download once (offline), then succeeds. */
let attempts = 0;
vi.mock('opentype.js', async (importOriginal) => {
  attempts += 1;
  if (attempts === 1) throw new Error('Failed to fetch dynamically imported module');
  return importOriginal();
});

describe('local font parser loading', () => {
  it('retries the parser chunk after a failed download', async () => {
    const { fontDefinitionFromBytes } = await import('./local-provider');
    const file = readFileSync('public/fonts/nunito.ttf');
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

    await expect(fontDefinitionFromBytes('local-a', 'nunito.ttf', bytes)).rejects.toThrow();
    const font = await fontDefinitionFromBytes('local-b', 'nunito.ttf', bytes);
    expect(font.name).toContain('Nunito');
  });
});
