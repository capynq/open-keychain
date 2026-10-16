// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import { DEFAULT_PARAMS, type KeychainParams } from '@/domain/keychain/model/types';

import { useFontSuggestions, type FontSuggestionOptions } from './useFontSuggestions';

describe('font suggestion discovery requests', () => {
  let root: Root;
  let container: HTMLDivElement;
  let suggestions: ReturnType<typeof useFontSuggestions>;

  const Harness = ({
    params,
    target = 'primary',
  }: {
    params: KeychainParams;
    target?: 'primary' | 'secondary';
  }) => {
    suggestions = useFontSuggestions(params, target, [], options);
    return null;
  };

  let resolveCatalog: (fonts: typeof FONT_CATALOG) => void;
  let providerPromise: Promise<typeof FONT_CATALOG>;
  let options: FontSuggestionOptions;
  const loadGoogleFonts = vi.fn(() => providerPromise);

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    providerPromise = new Promise((resolve) => {
      resolveCatalog = resolve;
    });
    loadGoogleFonts.mockClear();
    options = {
      googleFonts: [],
      googleAvailable: true,
      loadGoogleFonts,
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps only the newest request across signature changes and shares the catalog request', async () => {
    const firstParams = { ...DEFAULT_PARAMS, text: 'ALEX' };
    const nextParams = { ...DEFAULT_PARAMS, text: 'BETA' };

    await act(async () => root.render(createElement(Harness, { params: firstParams })));

    let firstRequest!: Promise<void>;

    act(() => {
      firstRequest = suggestions.loadMore();
    });
    await act(async () => Promise.resolve());
    expect(suggestions.isLoading).toBe(true);

    await act(async () => root.render(createElement(Harness, { params: nextParams })));
    let nextRequest!: Promise<void>;

    act(() => {
      nextRequest = suggestions.loadMore();
    });
    await act(async () => Promise.resolve());
    expect(loadGoogleFonts).toHaveBeenCalledTimes(1);
    expect(suggestions.isLoading).toBe(true);

    await act(async () => root.render(createElement(Harness, { params: firstParams })));
    let finalRequest!: Promise<void>;

    act(() => {
      finalRequest = suggestions.loadMore();
    });
    await act(async () => Promise.resolve());
    expect(loadGoogleFonts).toHaveBeenCalledTimes(1);
    expect(suggestions.isLoading).toBe(true);

    const discovered = {
      ...FONT_CATALOG[0],
      id: 'google-beta-font',
      name: 'Beta Font',
      source: 'google' as const,
      provider: 'google-fonts' as const,
    };

    resolveCatalog([discovered]);
    await act(async () => Promise.all([firstRequest, nextRequest, finalRequest]));

    expect(suggestions.pageFonts.flat().map((font) => font.id)).toContain('google-beta-font');
    expect(suggestions.revealBatch?.signature).toContain('ALEX');
    expect(suggestions.isLoading).toBe(false);
  });
});
