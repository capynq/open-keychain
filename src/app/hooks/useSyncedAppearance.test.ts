// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrintAppearanceOverrides } from '../../domain/keychain/model/types';

import { useSyncedAppearance } from './useSyncedAppearance';

describe('useSyncedAppearance', () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.unstubAllGlobals();
  });

  const render = () => {
    let api: ReturnType<typeof useSyncedAppearance> | undefined;
    const Harness = () => {
      api = useSyncedAppearance({ version: 1 });
      return null;
    };

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root?.render(createElement(Harness)));
    return () => api as ReturnType<typeof useSyncedAppearance>;
  };

  it('reads each write before React re-renders, so chained steps see the latest colors', () => {
    const getApi = render();
    const seen: PrintAppearanceOverrides[] = [];

    act(() => {
      const [, write, read] = getApi();

      write({ version: 1, base: '#111111' } as PrintAppearanceOverrides);
      seen.push(read());
      write((current) => ({ ...current, relief: '#222222' }) as PrintAppearanceOverrides);
      seen.push(read());
    });
    expect(seen).toEqual([
      { version: 1, base: '#111111' },
      { version: 1, base: '#111111', relief: '#222222' },
    ]);
    expect(getApi()[0]).toEqual({ version: 1, base: '#111111', relief: '#222222' });
  });
});
