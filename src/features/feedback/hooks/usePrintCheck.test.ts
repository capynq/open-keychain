// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerSurveyTransport } from '@/infrastructure/telemetry/feedback';
import {
  AnalyticsContext,
  type AnalyticsContextValue,
} from '@/infrastructure/telemetry/telemetry-context';

import { FEEDBACK_STORAGE_KEY } from '../model/feedback-storage';
import { usePrintCheck } from './usePrintCheck';

describe('usePrintCheck', () => {
  let root: Root;
  let container: HTMLDivElement;
  let check: ReturnType<typeof usePrintCheck>;
  const context: AnalyticsContextValue = {
    consent: 'declined',
    setConsent: vi.fn(),
    track: vi.fn(),
  };
  const Harness = () => {
    check = usePrintCheck('en');
    return null;
  };
  const render = async () => {
    await act(async () => {
      root.render(
        createElement(AnalyticsContext.Provider, { value: context }, createElement(Harness)),
      );
    });
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.setItem(
      FEEDBACK_STORAGE_KEY,
      JSON.stringify({ v: 1, lastExport: { at: Date.now() - 5 * 60 * 60 * 1000, format: 'stl' } }),
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    registerSurveyTransport(() => false, undefined);
    vi.unstubAllGlobals();
  });

  it('asks about an eligible export when answers can be sent', async () => {
    registerSurveyTransport(() => false, {
      host: 'https://posthog.test',
      apiKey: 'phc_test',
      context: () => ({}),
    });
    await render();

    expect(check.lastExport?.format).toBe('stl');
  });

  it('never asks in builds without a PostHog key, where the answer has nowhere to go', async () => {
    registerSurveyTransport(() => false, undefined);
    await render();

    expect(check.lastExport).toBeUndefined();
  });
});
