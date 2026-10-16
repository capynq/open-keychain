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

  const campaign = '?utm_source=portfolio&utm_medium=referral&utm_campaign=projects';
  const referralKey = 'open-keychain.acquisition-source';

  const reloadProvider = async () => {
    vi.resetModules();
    ({ AnalyticsProvider } = await import('./TelemetryProvider'));
    ({ AnalyticsContext } = await import('../telemetry-context'));
  };

  const makeSdkReady = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      posthogMock.client.__loaded = true;
      initConfig?.loaded?.();
    });
  };

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
              analytics?.track('setup_step_viewed', {
                step: 'review',
                name: 'ALEX',
                width: 80,
                acquisition_source: 'forged',
              }),
          },
          'track',
        ),
        createElement(
          'button',
          {
            'data-testid': 'export',
            onClick: () => analytics?.track('export_completed', { format: 'stl' }),
          },
          'export',
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
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');

    ({ AnalyticsProvider } = await import('./TelemetryProvider'));
    ({ AnalyticsContext } = await import('../telemetry-context'));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
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

    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'setup_step_viewed',
      expect.objectContaining({
        step: 'review',
        environment: expect.stringMatching(/^(development|preview)$/),
        internal_traffic: true,
      }),
    );
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

  it('keeps the fixed referral in memory before consent, then tags queued and export events', async () => {
    window.history.replaceState(null, '', `/${campaign}&name=PRIVATE`);
    await reloadProvider();
    await renderProvider();
    await click('track');
    expect(window.sessionStorage.getItem(referralKey)).toBeNull();
    expect(posthogMock.client.init).not.toHaveBeenCalled();
    expect(posthogMock.client.capture).not.toHaveBeenCalled();

    // The router can leave the landing URL before the visitor accepts analytics.
    window.history.replaceState(null, '', '/create');
    await click('accept');
    await click('track');
    expect(window.sessionStorage.getItem(referralKey)).toBe('portfolio');
    expect(posthogMock.client.capture).not.toHaveBeenCalled();
    await makeSdkReady();
    await click('export');

    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'setup_step_viewed',
      expect.objectContaining({ step: 'review', acquisition_source: 'portfolio' }),
    );
    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'export_completed',
      expect.objectContaining({ format: 'stl', acquisition_source: 'portfolio' }),
    );
    expect(JSON.stringify(posthogMock.client.capture.mock.calls)).not.toMatch(
      /PRIVATE|utm_|forged/,
    );
  });

  it('restores a consented referral on a refresh without campaign parameters', async () => {
    window.localStorage.setItem('open-keychain.analytics-consent', 'accepted');
    window.sessionStorage.setItem(referralKey, 'portfolio');
    window.history.replaceState(null, '', '/create');
    await reloadProvider();
    await renderProvider();
    await makeSdkReady();
    await click('export');
    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'export_completed',
      expect.objectContaining({ acquisition_source: 'portfolio' }),
    );
  });

  it.each([undefined, 'PRIVATE'])(
    'does not attribute direct visits or invalid stored markers: %s',
    async (stored) => {
      window.localStorage.setItem('open-keychain.analytics-consent', 'accepted');
      if (stored) window.sessionStorage.setItem(referralKey, stored);
      await reloadProvider();
      await renderProvider();
      await makeSdkReady();
      await click('track');
      expect(posthogMock.client.capture).toHaveBeenCalledOnce();
      expect(posthogMock.client.capture.mock.calls[0]?.[1]).not.toHaveProperty(
        'acquisition_source',
      );
      expect(window.sessionStorage.getItem(referralKey)).toBeNull();
    },
  );

  it('clears referral and queued events on decline and does not resurrect them on acceptance', async () => {
    window.history.replaceState(null, '', `/${campaign}`);
    await reloadProvider();
    await renderProvider();
    await click('accept');
    await click('track');
    await click('decline');
    expect(window.sessionStorage.getItem(referralKey)).toBeNull();
    await makeSdkReady();
    expect(posthogMock.client.capture).not.toHaveBeenCalled();

    await click('accept');
    await click('export');
    expect(posthogMock.client.capture).toHaveBeenCalledOnce();
    expect(posthogMock.client.capture.mock.calls[0]?.[1]).not.toHaveProperty('acquisition_source');
  });

  it('honors stored declined consent even on a tagged arrival', async () => {
    window.localStorage.setItem('open-keychain.analytics-consent', 'declined');
    window.sessionStorage.setItem(referralKey, 'portfolio');
    window.history.replaceState(null, '', `/${campaign}`);
    await reloadProvider();
    await renderProvider();
    await click('track');
    expect(window.sessionStorage.getItem(referralKey)).toBeNull();
    expect(posthogMock.client.init).not.toHaveBeenCalled();
    expect(posthogMock.client.capture).not.toHaveBeenCalled();
  });

  it('continues with an in-memory referral when browser storage is blocked', async () => {
    window.history.replaceState(null, '', `/${campaign}`);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await reloadProvider();
    await renderProvider();
    await click('accept');
    await makeSdkReady();
    await click('track');
    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'setup_step_viewed',
      expect.objectContaining({ acquisition_source: 'portfolio' }),
    );
    await click('decline');
    posthogMock.client.capture.mockClear();
    await click('accept');
    await click('track');
    expect(posthogMock.client.capture.mock.calls[0]?.[1]).not.toHaveProperty('acquisition_source');
  });
});
