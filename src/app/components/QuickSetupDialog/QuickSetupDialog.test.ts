// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalyticsContextValue } from '@/infrastructure/telemetry/telemetry-context';

import { AnalyticsContext } from '@/infrastructure/telemetry/telemetry-context';

import { QuickSetupDialog } from './QuickSetupDialog';

describe('QuickSetupDialog analytics', () => {
  let root: Root;
  let container: HTMLDivElement;
  let track: ReturnType<typeof vi.fn<AnalyticsContextValue['track']>>;

  const Harness = ({ supportsKeyring }: { supportsKeyring: boolean }) => {
    const [open, setOpen] = useState(true);
    const context: AnalyticsContextValue = {
      consent: 'accepted',
      setConsent: vi.fn(),
      track,
    };

    return createElement(
      AnalyticsContext.Provider,
      { value: context },
      createElement(QuickSetupDialog, {
        locale: 'en',
        open,
        onClose: () => setOpen(false),
        onApply: () => setOpen(false),
        initialText: 'ALEX',
        initialSize: { widthMm: 80, heightMm: 30 },
        supportsKeyring,
      }),
    );
  };

  const render = async (supportsKeyring: boolean) => {
    await act(async () => root.render(createElement(Harness, { supportsKeyring })));
  };
  const clickNext = async () => {
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[role="dialog"] footer button:last-child')!
        .click();
    });
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    track = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('records fixed step IDs in order and marks review complete after apply closes', async () => {
    await render(false);
    await clickNext();
    await clickNext();
    await clickNext();
    await clickNext();

    expect(track.mock.calls).toEqual([
      ['setup_step_viewed', { step: 'name-size' }],
      ['setup_step_completed', { step: 'name-size' }],
      ['setup_step_viewed', { step: 'fonts' }],
      ['setup_step_completed', { step: 'fonts' }],
      ['setup_step_viewed', { step: 'colors' }],
      ['setup_step_completed', { step: 'colors' }],
      ['setup_step_viewed', { step: 'review' }],
      ['setup_step_completed', { step: 'review' }],
    ]);
  });

  it('records keyring choices with stable option IDs', async () => {
    await render(true);
    await clickNext();
    await act(async () => {
      container
        .querySelector<HTMLInputElement>('input[name="keyring-position-setup"][value="right"]')!
        .click();
    });
    await clickNext();
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="oval-slot"]')!.click();
    });

    expect(track.mock.calls).toContainEqual([
      'customizer_option_changed',
      { family: 'keyring_position', option_id: 'right' },
    ]);
    expect(track.mock.calls).toContainEqual([
      'customizer_option_changed',
      { family: 'keyring_opening', option_id: 'oval-slot' },
    ]);
    expect(track.mock.calls).toContainEqual(['setup_step_viewed', { step: 'keyring-opening' }]);
  });
});
