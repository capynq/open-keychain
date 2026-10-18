// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS, type KeychainParams } from '../../domain/keychain/model/types';
import { copyTextToClipboard } from '../../shared/lib/clipboard';
import { useShareDesign, type ShareDesignApi } from './useShareDesign';

vi.mock('../../shared/lib/clipboard', () => ({ copyTextToClipboard: vi.fn() }));

const copyMock = vi.mocked(copyTextToClipboard);
const appearance = { version: 1 as const };

describe('useShareDesign', () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    copyMock.mockReset();
    vi.unstubAllGlobals();
  });

  const renderHook = (
    params: KeychainParams = DEFAULT_PARAMS,
  ): { getApi: () => ShareDesignApi; rerender: (value: KeychainParams) => void } => {
    let current: ShareDesignApi | undefined;
    const Harness = ({ value }: { value: KeychainParams }) => {
      current = useShareDesign({
        params: value,
        appearanceOverrides: appearance,
        hasNonBundledFont: false,
      });

      return null;
    };

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const rerender = (value: KeychainParams): void => {
      act(() => root?.render(createElement(StrictMode, null, createElement(Harness, { value }))));
    };

    rerender(params);

    return { getApi: () => current as ShareDesignApi, rerender };
  };

  it('ignores duplicate copy activation while the first operation is pending', async () => {
    let resolveCopy!: (result: boolean) => void;
    copyMock.mockReturnValueOnce(new Promise((resolve) => (resolveCopy = resolve)));
    const { getApi } = renderHook();

    await act(async () => {
      void getApi().copyLink();
      void getApi().copyLink();
    });
    expect(copyMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveCopy(true));
    expect(getApi().feedback.status).toBe('copied');
  });

  it('drops feedback from a design that has since changed', async () => {
    let resolveCopy!: (result: boolean) => void;
    copyMock.mockReturnValueOnce(new Promise((resolve) => (resolveCopy = resolve)));
    const { getApi, rerender } = renderHook();
    const changed = { ...DEFAULT_PARAMS, text: 'CHANGED' };

    await act(async () => void getApi().copyLink());
    rerender(changed);
    await act(async () => resolveCopy(true));
    expect(getApi().feedback.status).not.toBe('copied');
  });
});
