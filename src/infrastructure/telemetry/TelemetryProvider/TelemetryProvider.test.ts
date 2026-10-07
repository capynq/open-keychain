// @vitest-environment jsdom
import {
  act,
  createElement,
  useContext,
  type ComponentType,
  type Context,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalyticsContextValue } from '../telemetry-context';

const posthogMock = vi.hoisted(() => ({
  client: {
    __loaded: false,
    init: vi.fn(),
    has_opted_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}));

vi.mock('posthog-js', () => ({ default: posthogMock.client }));

type InitConfig = {
  loaded?: () => void;
  before_send?: (event: unknown) => unknown;
  capture_performance?: boolean;
  logs?: { captureConsoleLogs?: boolean };
  save_campaign_params?: boolean;
  save_referrer?: boolean;
  disable_capture_url_hashes?: boolean;
};

describe('AnalyticsProvider consent and startup', () => {
  let root: Root;
  let container: HTMLDivElement;
  let initConfig: InitConfig | undefined;
  let AnalyticsProvider: ComponentType<{ children: ReactNode }>;
  let AnalyticsContext: Context<AnalyticsContextValue | undefined>;

  const renderProvider = async () => {
    const Probe = () => {
      const analytics = useContext(AnalyticsContext);
      return createElement(
        'div',
        null,
        createElement(
          'button',
          { 'data-testid': 'accept', onClick: () => analytics?.setConsent('accepted') },
          'accept',
        ),
        createElement(
          'button',
          { 'data-testid': 'decline', onClick: () => analytics?.setConsent('declined') },
          'decline',
        ),
        createElement(
          'button',
          {
            'data-testid': 'track',
            onClick: () =>
              analytics?.track('setup_step_viewed', { step: 'review', name: 'ALEX', width: 80 }),
          },
          'track',
        ),
      );
    };

    await act(async () => {
      root.render(createElement(AnalyticsProvider, null, createElement(Probe)));
    });
  };

  const click = async (testId: string) => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    });
  };

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-project-key');
    vi.resetModules();
    vi.clearAllMocks();
    posthogMock.client.__loaded = false;
    posthogMock.client.has_opted_out_capturing.mockReturnValue(false);
    initConfig = undefined;
    posthogMock.client.init.mockImplementation((_key, config) => {
      initConfig = config as InitConfig;
    });
    window.localStorage.removeItem('open-keychain.analytics-consent');

    ({ AnalyticsProvider } = await import('./TelemetryProvider'));
    ({ AnalyticsContext } = await import('../telemetry-context'));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('queues sanitized action events until the consented SDK is ready', async () => {
    await renderProvider();
    await click('accept');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(posthogMock.client.init).toHaveBeenCalledTimes(1);
    expect(initConfig?.capture_performance).toBe(false);
    expect(initConfig?.logs?.captureConsoleLogs).toBe(false);
    expect(initConfig?.save_campaign_params).toBe(false);
    expect(initConfig?.save_referrer).toBe(false);
    expect(initConfig?.disable_capture_url_hashes).toBe(true);
    await click('track');
    expect(posthogMock.client.capture).not.toHaveBeenCalled();

    posthogMock.client.__loaded = true;
    await act(async () => initConfig?.loaded?.());

    expect(posthogMock.client.capture).toHaveBeenCalledWith('setup_step_viewed', {
      step: 'review',
    });
  });

  it('does not initialize or send events if consent is declined during SDK loading', async () => {
    await renderProvider();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="accept"]')!.click();
      container.querySelector<HTMLButtonElement>('[data-testid="decline"]')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await click('track');

    expect(posthogMock.client.init).not.toHaveBeenCalled();
    expect(posthogMock.client.capture).not.toHaveBeenCalled();
  });

  it('opts out and clears queued events if consent is declined before SDK readiness', async () => {
    await renderProvider();
    await click('accept');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await click('track');
    await click('decline');

    posthogMock.client.__loaded = true;
    await act(async () => initConfig?.loaded?.());

    expect(posthogMock.client.opt_out_capturing).toHaveBeenCalledOnce();
    expect(posthogMock.client.reset).toHaveBeenCalledOnce();
    expect(posthogMock.client.capture).not.toHaveBeenCalled();
  });
});
