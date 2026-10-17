import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

import { navigationMotion, type MotionIntent } from '@/shared/lib/motion';

type RevealBatch = { revision: number; fontIds: string[] };

/** One bounded entrance for the visible portion of a successful discovery. */
export const useDiscoveryMotion = (
  pagesRef: RefObject<HTMLDivElement | null>,
  batch: RevealBatch | undefined,
  page: number,
  context: string,
) => {
  const intentRef = useRef<MotionIntent>('instant');
  const consumedRevision = useRef(0);
  const restoringFocus = useRef(false);
  const animationsRef = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const cancel = (): void => {
      for (const animation of animationsRef.current) animation.cancel();
      animationsRef.current = [];
    };
    const interrupt = (): void => {
      intentRef.current = 'instant';
      cancel();
    };
    const focus = (): void => {
      if (!restoringFocus.current) interrupt();
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = (): void => {
      if (media.matches) interrupt();
    };

    document.addEventListener('keydown', interrupt, true);
    document.addEventListener('focusin', focus, true);
    pagesRef.current?.addEventListener('pointerdown', interrupt);
    pagesRef.current?.addEventListener('wheel', interrupt, { passive: true });
    media.addEventListener('change', preference);
    const pages = pagesRef.current;

    return () => {
      interrupt();
      document.removeEventListener('keydown', interrupt, true);
      document.removeEventListener('focusin', focus, true);
      pages?.removeEventListener('pointerdown', interrupt);
      pages?.removeEventListener('wheel', interrupt);
      media.removeEventListener('change', preference);
    };
  }, [pagesRef, context]);

  useLayoutEffect(() => {
    const pages = pagesRef.current;
    if (!batch || !pages || batch.revision === consumedRevision.current) return;
    consumedRevision.current = batch.revision;
    const intent = intentRef.current;

    intentRef.current = 'instant';
    if (navigationMotion(intent) === 'instant') return;
    const visiblePage = pages.children[page - 1];
    const cards = Array.from(
      visiblePage?.querySelectorAll<HTMLElement>('[data-font-id]') ?? [],
    ).filter((card) => batch.fontIds.includes(card.dataset.fontId ?? ''));
    const tokens = getComputedStyle(pages);
    const duration = parseFloat(tokens.getPropertyValue('--workshop-motion-discovery'));
    const stagger = parseFloat(tokens.getPropertyValue('--workshop-motion-stagger'));
    const easing = tokens.getPropertyValue('--workshop-ease').trim();
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(stagger)) return;
    animationsRef.current = cards.slice(0, 3).flatMap((card, index) =>
      card.matches(':has(:focus-visible)') || !card.animate
        ? []
        : [
            card.animate(
              [
                { opacity: 0.35, translate: '0 4px' },
                { opacity: 1, translate: '0 0' },
              ],
              { duration, delay: index * stagger, easing, fill: 'backwards' },
            ),
          ],
    );
    return () => {
      for (const animation of animationsRef.current) animation.cancel();
      animationsRef.current = [];
    };
  }, [batch, page, context, pagesRef]);

  const beginDiscovery = useCallback((intent: MotionIntent): void => {
    for (const animation of animationsRef.current) animation.cancel();
    animationsRef.current = [];
    intentRef.current = intent;
  }, []);
  const focusAfterDiscovery = useCallback((element: HTMLElement | null | undefined): void => {
    // Owned recovery keeps other cards revealing, but the focused card is immediate.
    for (const animation of animationsRef.current) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target instanceof Element && element && target.contains(element)) animation.cancel();
    }
    restoringFocus.current = true;
    try {
      element?.focus({ preventScroll: true });
    } finally {
      restoringFocus.current = false;
    }
  }, []);

  return { beginDiscovery, focusAfterDiscovery };
};
