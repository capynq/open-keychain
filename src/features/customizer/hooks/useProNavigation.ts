import type { RefObject } from 'react';

import { useEffect, useRef } from 'react';

import { navigationMotion, type MotionIntent } from '@/shared/lib/motion';

import type { SimpleOptionGroup } from '../model/simple-options';
import type { EditorMode } from './useEditorMode';

/** Reveal the matching controls only after the Pro layout has mounted. */
export const useProNavigation = (
  mode: EditorMode,
  changeMode: (mode: EditorMode) => void,
  controlsRef: RefObject<HTMLElement | null>,
) => {
  const destination = useRef<{
    target: SimpleOptionGroup['presentation'];
    intent: MotionIntent;
  } | null>(null);

  useEffect(() => {
    if (mode !== 'pro' || !destination.current) return;

    const frame = requestAnimationFrame(() => {
      const request = destination.current;
      if (!request) return;
      const panel = controlsRef.current;
      const section =
        panel?.querySelector<HTMLElement>(`[data-adjustment-subcategory="${request.target}"]`) ??
        panel?.querySelector<HTMLElement>('[data-testid="adjustment-settings"]');

      destination.current = null;
      if (!section) return;

      const heading = section.querySelector<HTMLElement>('h2, h3') ?? section;

      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      // Native scrolling reaches the rail on desktop and its workspace ancestor on mobile.
      heading.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: navigationMotion(request.intent),
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [mode, controlsRef]);

  return (target: SimpleOptionGroup['presentation'], intent: MotionIntent): void => {
    destination.current = { target, intent };
    changeMode('pro');
  };
};
