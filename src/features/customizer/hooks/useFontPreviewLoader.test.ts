import { afterEach, describe, expect, it, vi } from 'vitest';

import { FONT_CATALOG, type FontDefinition } from '@/domain/keychain/fonts/catalog';

import { loadPreviewFont } from './useFontPreviewLoader';

const externalFont = (id: string): FontDefinition => ({
  ...FONT_CATALOG[0],
  id,
  source: 'google',
  provider: 'google-fonts',
});

afterEach(() => vi.unstubAllGlobals());

describe('shared font preview loading', () => {
  it('retries after a synchronous FontFace construction failure', async () => {
    let attempts = 0;
    const add = vi.fn();

    vi.stubGlobal('document', { fonts: { add } });
    vi.stubGlobal(
      'FontFace',
      class {
        constructor() {
          attempts += 1;
          if (attempts === 1) throw new Error('temporary failure');
        }
        async load() {
          return this;
        }
      },
    );
    const font = externalFont('sync-retry-fixture');

    expect(await loadPreviewFont(font)).toBe(false);
    expect(await loadPreviewFont(font)).toBe(true);
    expect(attempts).toBe(2);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request and reuses the successful face', async () => {
    let complete: (value: object) => void = () => undefined;
    const pending = new Promise<object>((resolve) => {
      complete = resolve;
    });
    const load = vi.fn(() => pending);
    const add = vi.fn();

    vi.stubGlobal('document', { fonts: { add } });
    vi.stubGlobal(
      'FontFace',
      class {
        load = load;
      },
    );
    const font = externalFont('shared-promise-fixture');
    const first = loadPreviewFont(font);

    expect(loadPreviewFont(font)).toBe(first);
    complete({});
    expect(await first).toBe(true);
    expect(await loadPreviewFont(font)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });
});
