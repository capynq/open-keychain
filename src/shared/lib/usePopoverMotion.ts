import { useSyncExternalStore } from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const instantSnapshot = (): string => '0:0';
const durationMs = (value: string): number => {
  const amount = Number.parseFloat(value);

  return Number.isFinite(amount) ? amount * (value.trim().endsWith('ms') ? 1 : 1000) : 0;
};

const snapshot = (): string => {
  if (typeof window === 'undefined') return instantSnapshot();

  if (
    document.documentElement.dataset.inputModality !== 'pointer' ||
    window.matchMedia(reducedMotionQuery).matches
  )
    return instantSnapshot();

  const tokens = getComputedStyle(document.documentElement);

  return `${durationMs(tokens.getPropertyValue('--workshop-motion-control'))}:${durationMs(tokens.getPropertyValue('--workshop-motion-fast'))}`;
};

const subscribe = (notify: () => void): (() => void) => {
  const preference = window.matchMedia(reducedMotionQuery);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-input-modality'],
  });
  preference.addEventListener('change', notify);

  return () => {
    observer.disconnect();
    preference.removeEventListener('change', notify);
  };
};

/** Keep presence timing aligned with the CSS roles and live input/accessibility policy. */
export const usePopoverMotion = () => {
  const value = useSyncExternalStore(subscribe, snapshot, instantSnapshot);
  const [open, close] = value.split(':').map(Number);

  return { enabled: open > 0, duration: { open, close } };
};
