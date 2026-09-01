import { useEffect, useRef, useState } from 'react';

export type ControlsScrollState = 'top' | 'middle' | 'bottom' | 'none';

/** Tracks whether the controls rail can scroll and exposes a11y-friendly state. */
export const useControlsScrollState = () => {
  const controlsRef = useRef<HTMLElement>(null);
  const [scrollState, setScrollState] = useState<ControlsScrollState>('none');

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;

    const updateScrollState = (): void => {
      const atTop = controls.scrollTop <= 1;
      const atBottom = controls.scrollHeight - controls.clientHeight - controls.scrollTop <= 1;
      setScrollState(
        controls.scrollHeight <= controls.clientHeight
          ? 'none'
          : atTop
            ? 'top'
            : atBottom
              ? 'bottom'
              : 'middle',
      );
    };

    updateScrollState();
    controls.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      controls.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  return { controlsRef, scrollState };
};
