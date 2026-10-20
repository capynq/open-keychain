// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyticsContext,
  type AnalyticsContextValue,
} from '@/infrastructure/telemetry/telemetry-context';

import { PrivacyPage } from './PrivacyPage';

describe('PrivacyPage consent controls', () => {
  let container: HTMLDivElement;
  let root: Root;
  const setConsent = vi.fn();
  const value: AnalyticsContextValue = {
    consent: 'accepted',
    setConsent,
    track: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('explains replay collection and lets visitors revoke consent', async () => {
    await act(async () => {
      root.render(
        createElement(
          AnalyticsContext.Provider,
          { value },
          createElement(MemoryRouter, null, createElement(PrivacyPage, { locale: 'en' })),
        ),
      );
    });

    expect(container.textContent).toContain('3D/WebGL preview');
    expect(container.textContent).toContain('retained for 30 days');
    expect(container.textContent).toContain('allowed in this browser');

    const decline = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'No thanks',
    );
    expect(decline).toBeDefined();
    await act(async () => decline?.click());
    expect(setConsent).toHaveBeenCalledWith('declined');
  });
});
