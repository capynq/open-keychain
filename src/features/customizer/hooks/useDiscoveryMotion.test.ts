// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MotionIntent } from '@/shared/lib/motion';

import { useDiscoveryMotion } from './useDiscoveryMotion';

describe('visible discovery motion', () => {
  let root: Root;
  let host: HTMLDivElement;
  let begin: (intent: MotionIntent) => void;
  let recoverFocus: (element: HTMLElement) => void;
  let reduced: boolean;
  let preference: (() => void) | undefined;
  const cancels: ReturnType<typeof vi.fn>[] = [];
  const animate = vi.fn(function (this: HTMLElement) {
    const cancel = vi.fn();

    cancels.push(cancel);
    return { cancel, effect: { target: this } };
  });
  const batch = { revision: 1, fontIds: ['a', 'b', 'c', 'd', 'e', 'f'] };
  const Harness = ({ revealed = false, page = 1, context = 'a' }) => {
    const pages = useRef<HTMLDivElement>(null);

    const motion = useDiscoveryMotion(pages, revealed ? batch : undefined, page, context);

    begin = motion.beginDiscovery;
    recoverFocus = motion.focusAfterDiscovery;
    return createElement(
      'div',
      { ref: pages },
      ...[
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ].map((ids, index) =>
        createElement(
          'div',
          { key: index },
          ...ids.map((id) => createElement('label', { key: id, 'data-font-id': id }, id)),
        ),
      ),
    );
  };
  const render = (props: Parameters<typeof Harness>[0] = {}) =>
    act(() => root.render(createElement(Harness, props)));

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    reduced = false;
    cancels.length = 0;
    animate.mockClear();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_: string, listener: () => void) => {
        preference = listener;
      },
      removeEventListener: () => {
        preference = undefined;
      },
    }));
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (key: string) =>
        ({
          '--workshop-motion-discovery': '140ms',
          '--workshop-motion-stagger': '60ms',
          '--workshop-ease': 'cubic-bezier(0.23, 1, 0.32, 1)',
        })[key],
    }));
    vi.stubGlobal('Animation', class {});
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    document.documentElement.dataset.inputModality = 'pointer';
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    delete document.documentElement.dataset.inputModality;
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('animates only three visible new cards, once, within 260ms', () => {
    render();
    begin('smooth');
    render({ revealed: true });
    expect(animate).toHaveBeenCalledTimes(3);
    expect(
      animate.mock.calls.map(
        (call) => (call as unknown as [unknown, KeyframeAnimationOptions])[1].delay,
      ),
    ).toEqual([0, 60, 120]);
    render({ revealed: true, page: 2 });
    expect(cancels.every((cancel) => cancel.mock.calls.length > 0)).toBe(true);
    expect(animate).toHaveBeenCalledTimes(3);
  });

  it('does not animate a keyboard request even if pointer modality changes before completion', () => {
    render();
    begin('instant');
    render({ revealed: true });
    expect(animate).not.toHaveBeenCalled();
  });

  it('interrupts pending pointer intent on keyboard input before completion', () => {
    render();
    begin('smooth');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    render({ revealed: true });
    expect(animate).not.toHaveBeenCalled();
  });

  it('restores focus immediately while preserving the other visible card reveals', () => {
    render();
    begin('smooth');
    render({ revealed: true });
    const card = host.querySelector('label')!;

    card.tabIndex = 0;
    recoverFocus(card);
    expect(document.activeElement).toBe(card);
    expect(cancels[0]).toHaveBeenCalledOnce();
    expect(cancels[1]).not.toHaveBeenCalled();
    expect(cancels[2]).not.toHaveBeenCalled();
  });

  it('interrupts pending intent when focus changes before the response arrives', () => {
    render();
    begin('smooth');
    host.querySelector('label')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    render({ revealed: true });
    expect(animate).not.toHaveBeenCalled();
  });

  it.each(['focus', 'preference', 'keyboard'])('cancels active reveals on %s', (reason) => {
    render();
    begin('smooth');
    render({ revealed: true });
    expect(animate).toHaveBeenCalledTimes(3);
    if (reason === 'focus')
      host.querySelector('label')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    if (reason === 'keyboard') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    if (reason === 'preference') {
      reduced = true;
      preference?.();
    }
    expect(cancels.every((cancel) => cancel.mock.calls.length > 0)).toBe(true);
  });

  it('clears pending intent on context change and removes the preference listener on unmount', () => {
    render();
    begin('smooth');
    render({ revealed: true, context: 'b' });
    expect(animate).not.toHaveBeenCalled();
    act(() => root.unmount());
    expect(preference).toBeUndefined();
    root = createRoot(host);
  });
});
