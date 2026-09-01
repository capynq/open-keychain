import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { fontDefinitionFromBytes, isLocalFontId } from './local-provider';

describe('local font metadata', () => {
  it('uses OpenType names and marks imported fonts as non-articulated', () => {
    const file = readFileSync('public/fonts/nunito.ttf');
    const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const font = fontDefinitionFromBytes('local-test', 'nunito.ttf', bytes);
    expect(font.name).toContain('Nunito');
    expect(font.provider).toBe('local-file');
    expect(font.source).toBe('local');
    expect(font.supportsArticulated).toBe(false);
    expect(font.data).toBeDefined();
  });

  it('recognizes ids that must not be persisted as hosted params', () => {
    expect(isLocalFontId('local-abc')).toBe(true);
    expect(isLocalFontId('nunito')).toBe(false);
  });
});
