// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { usePopoverMotion } from './usePopoverMotion';

it('uses CSS timing roles only for pointer input and observes preference changes live', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let reduce = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduce;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  const html = document.documentElement;
  const previousStyle = html.getAttribute('style');
  const previousInput = html.dataset.inputModality;
  html.style.setProperty('--workshop-motion-control', '0.2s');
  html.style.setProperty('--workshop-motion-fast', '160ms');
  html.dataset.inputModality = 'keyboard';
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let motion!: ReturnType<typeof usePopoverMotion>;
  const Harness = () => {
    motion = usePopoverMotion();

    return createElement('output');
  };

  try {
    act(() => root.render(createElement(Harness)));
    expect(motion).toEqual({ enabled: false, duration: { open: 0, close: 0 } });
    await act(async () => {
      html.dataset.inputModality = 'pointer';
      await Promise.resolve();
    });
    expect(motion).toEqual({ enabled: true, duration: { open: 200, close: 160 } });
    act(() => {
      reduce = true;
      listeners.forEach((notify) => notify());
    });
    expect(motion.enabled).toBe(false);
    act(() => {
      reduce = false;
      listeners.forEach((notify) => notify());
    });
    expect(motion.enabled).toBe(true);
    await act(async () => {
      html.dataset.inputModality = 'keyboard';
      await Promise.resolve();
    });
    expect(motion.duration).toEqual({ open: 0, close: 0 });
  } finally {
    act(() => root.unmount());
    expect(listeners.size).toBe(0);
    host.remove();
    if (previousStyle === null) html.removeAttribute('style');
    else html.setAttribute('style', previousStyle);

    if (previousInput === undefined) delete html.dataset.inputModality;
    else html.dataset.inputModality = previousInput;

    vi.unstubAllGlobals();
  }
});
