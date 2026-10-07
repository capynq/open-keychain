// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fontDefinition } from '@/domain/keychain/fonts/catalog';
import { DEFAULT_PARAMS, type KeychainParams } from '@/domain/keychain/model/types';

import type { QuickSetupChanges } from '../model/quick-setup';
import type { useCustomizerParams } from './useCustomizerParams';

import { useQuickSetup } from './useQuickSetup';

describe('setup transaction', () => {
  let root: Root;
  let container: HTMLDivElement;
  let setup: ReturnType<typeof useQuickSetup>;
  const appearance = vi.fn();
  const navigate = vi.fn();
  const changes: QuickSetupChanges = {
    text: 'ALEX',
    sizeEnvelope: { widthMm: 80, heightMm: 30 },
    favoriteFontCategories: ['Marker'],
    appearanceOverrides: { version: 1, base: '#123456', relief: '#FEDCBA' },
  };
  const buildCustomizer = () => ({
    acceptedParams: { ...DEFAULT_PARAMS, sizeEnvelope: changes.sizeEnvelope } as KeychainParams,
    candidateFeedback: undefined as ReturnType<typeof useCustomizerParams>['candidateFeedback'],
    selectedFont: fontDefinition(DEFAULT_PARAMS.fontId),
    clearCandidateFeedback: vi.fn(),
    updateMany: vi.fn(),
  });
  const render = async (customizer: ReturnType<typeof buildCustomizer>) => {
    await act(async () => {
      root.render(createElement(Harness, { customizer }));
    });
  };
  const Harness = ({ customizer }: { customizer: ReturnType<typeof buildCustomizer> }) => {
    setup = useQuickSetup({
      search: '?setup=1',
      locationState: null,
      locale: 'en',
      navigate,
      customizer: customizer as unknown as ReturnType<typeof useCustomizerParams>,
      onAppearanceChange: appearance,
    });
    return null;
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    appearance.mockClear();
    navigate.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('blocks submission during another candidate but keeps unsubmitted setup dismissible', async () => {
    const customizer = buildCustomizer();

    customizer.candidateFeedback = { requestId: 1, status: 'checking', group: 'print' };
    await render(customizer);
    await act(async () => setup.applySetup(changes));
    expect(customizer.updateMany).not.toHaveBeenCalled();
    expect(customizer.clearCandidateFeedback).not.toHaveBeenCalled();
    expect(appearance).not.toHaveBeenCalled();
    expect(setup.setupSubmitting).toBe(false);
    await act(async () => setup.closeSetup());
    expect(setup.setupOpen).toBe(false);
    customizer.candidateFeedback = { requestId: 1, status: 'rejected', group: 'print' };
    await render(customizer);
    await act(async () => setup.openSetup());
    customizer.clearCandidateFeedback.mockImplementation(() => {
      customizer.candidateFeedback = undefined;
    });
    await act(async () => setup.applySetup(changes));
    expect(appearance).toHaveBeenCalledWith(changes.appearanceOverrides);
    expect(JSON.parse(localStorage.getItem('open-keychain.favorite-font-categories')!)).toEqual([
      'Marker',
    ]);
  });

  it('stages appearance/preferences until acceptance and keeps a rejected draft open', async () => {
    const customizer = buildCustomizer();

    customizer.acceptedParams = { ...DEFAULT_PARAMS, sizeEnvelope: undefined };
    customizer.updateMany.mockImplementation(() => {
      customizer.candidateFeedback = { requestId: 2, status: 'checking', group: 'template' };
    });
    await render(customizer);
    await act(async () => setup.applySetup(changes));
    expect(setup.setupSubmitting).toBe(true);
    expect(appearance).not.toHaveBeenCalled();
    expect(localStorage.getItem('open-keychain.favorite-font-categories')).toBeNull();
    customizer.candidateFeedback = { requestId: 2, status: 'rejected', group: 'template' };
    await render(customizer);
    expect(setup.setupError).toBe(true);
    expect(setup.setupOpen).toBe(true);
    expect(setup.setupSubmitting).toBe(false);
    expect(appearance).not.toHaveBeenCalled();
  });
  it('does not commit a setup superseded by a different accepted model', async () => {
    const customizer = buildCustomizer();

    customizer.acceptedParams = { ...DEFAULT_PARAMS, sizeEnvelope: undefined };
    customizer.updateMany.mockImplementation(() => {
      customizer.candidateFeedback = { requestId: 3, status: 'checking', group: 'template' };
    });
    await render(customizer);
    await act(async () => setup.applySetup(changes));
    customizer.acceptedParams = { ...customizer.acceptedParams, styleId: 'bubble' };
    customizer.candidateFeedback = undefined;
    await render(customizer);
    expect(setup.setupError).toBe(true);
    expect(setup.setupOpen).toBe(true);
    expect(appearance).not.toHaveBeenCalled();
    expect(localStorage.getItem('open-keychain.favorite-font-categories')).toBeNull();
  });
});
