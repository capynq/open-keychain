import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalFontStore, fontDefinitionFromBytes, isLocalFontId } from './local-provider';

afterEach(() => vi.unstubAllGlobals());

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

  it('reports imported font parse failures through the operational callback', async () => {
    const onFailure = vi.fn();
    const store = createLocalFontStore({ onFailure });
    const file = {
      name: 'broken.ttf',
      arrayBuffer: async () => new ArrayBuffer(4),
    } as unknown as File;

    await store.importFiles([file]);

    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'local-font-import-failed' }),
    );
  });

  it('treats native picker cancellation as neutral', async () => {
    const onFailure = vi.fn();
    vi.stubGlobal('window', {
      showOpenFilePicker: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
    });
    const store = createLocalFontStore({ onFailure });

    await store.pick();

    expect(onFailure).not.toHaveBeenCalled();
  });
});
