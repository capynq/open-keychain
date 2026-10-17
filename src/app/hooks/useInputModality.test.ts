// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { activationMotion, navigationMotion } from '@/shared/lib/motion';

import { useInputModality } from './useInputModality';

it('tracks input without changing focus, rechecks navigation policy, and removes listeners', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let reduce = false;

  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduce;
    },
  }));
  const host = document.createElement('div');

  document.body.append(host);
  const root = createRoot(host);
  const Harness = () => {
    useInputModality();
    return createElement('button', null, 'Action');
  };

  try {
    act(() => root.render(createElement(Harness)));
    const button = host.querySelector('button')!;

    button.focus();
    expect(navigationMotion('smooth')).toBe('instant');
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(navigationMotion(activationMotion({ detail: 1 }))).toBe('smooth');
    expect(navigationMotion(activationMotion({ detail: 0 }))).toBe('instant');
    button.click();
    expect(navigationMotion('smooth')).toBe('instant');
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    expect(navigationMotion('smooth')).toBe('smooth');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(navigationMotion('smooth')).toBe('instant');
    expect(document.activeElement).toBe(button);
    const touchMove = Object.assign(new Event('pointermove'), { pointerType: 'touch' });

    document.dispatchEvent(touchMove);
    expect(navigationMotion('smooth')).toBe('instant');
    const mouseMove = Object.assign(new Event('pointermove'), { pointerType: 'mouse' });

    document.dispatchEvent(mouseMove);
    expect(navigationMotion('smooth')).toBe('smooth');
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    reduce = true;
    expect(navigationMotion('smooth')).toBe('instant');
  } finally {
    act(() => root.unmount());
    document.dispatchEvent(new Event('pointerdown'));
    expect(document.documentElement.dataset.inputModality).toBeUndefined();
    host.remove();
    vi.unstubAllGlobals();
  }
});
