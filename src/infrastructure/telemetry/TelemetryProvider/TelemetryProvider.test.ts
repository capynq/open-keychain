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
    captureException: vi.fn(),
    startSessionRecording: vi.fn(),
  },
}));
const testBundleRelease = `0.1.0-beta.1+${'a'.repeat(40)}`;

vi.mock('posthog-js', () => ({ default: posthogMock.client }));

type InitConfig = {
  loaded?: () => void;
  before_send?: (event: unknown) => unknown;
  capture_performance?: boolean;
  autocapture?: boolean;
  capture_dead_clicks?: boolean;
  capture_exceptions?: {
    capture_unhandled_errors?: boolean;
    capture_unhandled_rejections?: boolean;
    capture_console_errors?: boolean;
  };
  logs?: { captureConsoleLogs?: boolean };
  disable_session_recording?: boolean;
  session_recording?: {
    sampleRate?: number;
    maskAllInputs?: boolean;
    captureCanvas?: { recordCanvas?: boolean };
    canvasCapture?: { resolutionScale?: number };
  };
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
  let captureReactException: (error: Error) => void;

  const campaign = '?utm_source=portfolio&utm_medium=referral&utm_campaign=projects';
  const referralKey = 'open-keychain.acquisition-source';

  const reloadProvider = async () => {
    vi.resetModules();
    ({ AnalyticsProvider } = await import('./TelemetryProvider'));
    ({ captureReactException } = await import('../react-exceptions'));
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
                app_version: 'f'.repeat(40),
                app_release: 'forged-release',
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
        createElement(
          'button',
          {
            'data-testid': 'export-failed',
            onClick: () =>
              analytics?.track('export_failed', {
                format: 'stl',
                operation: 'export',
                export_attempt_id: 'attempt-1',
                error_code: 'export_failed',
              }),
          },
          'export failed',
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
    vi.stubGlobal('__OPEN_KEYCHAIN_RELEASE__', testBundleRelease);
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

    await reloadProvider();
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
    expect(initConfig?.autocapture).toBe(true);
    expect(initConfig?.capture_dead_clicks).toBe(true);
    expect(initConfig?.capture_performance).toBe(true);
    expect(initConfig?.capture_exceptions).toEqual({
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    });
    expect(initConfig?.logs?.captureConsoleLogs).toBe(true);
    expect(initConfig?.disable_session_recording).toBe(false);
    expect(initConfig?.session_recording).toEqual({
      sampleRate: 1,
      maskAllInputs: false,
      captureCanvas: { recordCanvas: true },
      canvasCapture: { resolutionScale: 0.6 },
    });
    const sdkEvent = initConfig?.before_send?.({
      properties: {
        $current_url: 'https://open-keychain.com/create?name=PRIVATE',
        $referrer: 'https://private.example/',
        app_version: 'e'.repeat(40),
        app_release: 'forged-sdk-release',
      },
    }) as { properties: Record<string, unknown> };
    expect(sdkEvent.properties).toMatchObject({
      $current_url: 'https://open-keychain.com/create',
      environment: expect.stringMatching(/^(development|preview)$/),
      internal_traffic: true,
    });
    expect(sdkEvent.properties.app_version).not.toBe('e'.repeat(40));
    expect(sdkEvent.properties.app_release).toBe(testBundleRelease);
    expect(sdkEvent.properties).not.toHaveProperty('$referrer');
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
    expect(posthogMock.client.capture.mock.calls[0]?.[1]?.app_version).not.toBe('f'.repeat(40));
    expect(posthogMock.client.capture.mock.calls[0]?.[1]?.app_release).toBe(testBundleRelease);
    const automaticException = initConfig?.before_send?.({
      event: '$exception',
      properties: { app_version: 'd'.repeat(40), app_release: 'forged-exception-release' },
    }) as { properties: Record<string, unknown> };
    expect(automaticException.properties.app_version).not.toBe('d'.repeat(40));
    expect(automaticException.properties.app_release).toBe(testBundleRelease);
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

  it('captures React boundary errors and starts high-signal replay only after accepted consent', async () => {
    await renderProvider();
    captureReactException(new Error('PRIVATE DESIGN TEXT'));
    expect(posthogMock.client.captureException).not.toHaveBeenCalled();

    await click('accept');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const queuedError = new Error('render failed while SDK loads');
    captureReactException(queuedError);
    expect(posthogMock.client.captureException).not.toHaveBeenCalled();
    await makeSdkReady();
    expect(posthogMock.client.captureException).toHaveBeenCalledWith(queuedError, {
      error_boundary: 'route',
    });
    const error = new Error('render failed');
    captureReactException(error);

    expect(posthogMock.client.startSessionRecording).toHaveBeenCalledWith({ sampling: true });
    expect(posthogMock.client.captureException).toHaveBeenCalledWith(error, {
      error_boundary: 'route',
    });
    await click('decline');
    posthogMock.client.captureException.mockClear();
    captureReactException(new Error('PRIVATE DESIGN TEXT'));
    expect(posthogMock.client.captureException).not.toHaveBeenCalled();
  });

  it('forces replay on export failures without converting the structured event into an exception', async () => {
    await renderProvider();
    await click('accept');
    await makeSdkReady();
    posthogMock.client.startSessionRecording.mockClear();
    await click('export-failed');

    expect(posthogMock.client.startSessionRecording).toHaveBeenCalledWith({ sampling: true });
    expect(posthogMock.client.capture).toHaveBeenCalledWith(
      'export_failed',
      expect.objectContaining({ operation: 'export', format: 'stl' }),
    );
    expect(posthogMock.client.captureException).not.toHaveBeenCalled();
  });

  it('stops collection when consent is revoked from another tab', async () => {
    await renderProvider();
    await click('accept');
    await makeSdkReady();
    posthogMock.client.opt_out_capturing.mockClear();
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'open-keychain.analytics-consent',
          oldValue: 'accepted',
          newValue: 'declined',
        }),
      );
    });

    expect(posthogMock.client.opt_out_capturing).toHaveBeenCalledOnce();
    expect(posthogMock.client.reset).toHaveBeenCalledOnce();
    captureReactException(new Error('must not send'));
    expect(posthogMock.client.captureException).not.toHaveBeenCalled();
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
