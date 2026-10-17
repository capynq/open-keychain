export type MotionIntent = 'instant' | 'smooth';

/** Synthetic/keyboard activation defaults to the immediate path. */
export const activationMotion = (event: { detail: number }): MotionIntent =>
  event.detail > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'smooth'
    : 'instant';

export const navigationMotion = (intent: MotionIntent): MotionIntent =>
  document.documentElement.dataset.inputModality === 'pointer' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? intent
    : 'instant';
