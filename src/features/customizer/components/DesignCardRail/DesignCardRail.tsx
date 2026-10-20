import type { ReactNode } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { activationMotion, navigationMotion, type MotionIntent } from '@/shared/lib/motion';
import { IconButton } from '@/shared/ui/IconButton';

import styles from './DesignCardRail.module.css';

export type DesignCardRailProps = {
  label: string;
  nextLabel: string;
  previousLabel: string;
  className?: string;
  children: ReactNode;
};

export const DesignCardRail = ({
  label,
  nextLabel,
  previousLabel,
  className,
  children,
}: DesignCardRailProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<'none' | 'top' | 'middle' | 'bottom'>('none');

  const updateScrollState = useCallback((rail = railRef.current): void => {
    if (!rail) return;
    const atStart = rail.scrollLeft <= 8;
    const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
    const nextState =
      rail.scrollWidth <= rail.clientWidth + 1
        ? 'none'
        : atStart
          ? 'top'
          : atEnd
            ? 'bottom'
            : 'middle';

    setScrollState(nextState);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;

    const update = (): void => updateScrollState(rail);
    const resizeObserver = new ResizeObserver(update);
    const mutationObserver = new MutationObserver(() => {
      resizeObserver.disconnect();
      resizeObserver.observe(rail);
      for (const child of rail.children) resizeObserver.observe(child);
      update();
    });

    resizeObserver.observe(rail);
    for (const child of rail.children) resizeObserver.observe(child);
    mutationObserver.observe(rail, { childList: true });
    update();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollByCardStep = (direction: -1 | 1, intent: MotionIntent): void => {
    const rail = railRef.current;
    if (!rail) return;

    const firstCard = rail.firstElementChild;
    const cardStep = firstCard ? firstCard.getBoundingClientRect().width + 9 : 0;

    rail.scrollBy({
      left: direction * Math.max(cardStep, rail.clientWidth * 0.75),
      behavior: navigationMotion(intent),
    });
  };

  return (
    <div
      className={`${styles['design-card-rail-root-marker']} design-card-rail-shell`}
      data-scroll-state={scrollState}
    >
      <div
        ref={railRef}
        className={`design-card-rail${className ? ` ${className}` : ''}`}
        role="group"
        aria-label={label}
        onScroll={(event) => updateScrollState(event.currentTarget)}
      >
        {children}
      </div>
      <IconButton
        action="design-card-rail-previous"
        className="design-card-rail-previous"
        icon={ChevronLeft}
        label={previousLabel}
        motion="nudge"
        onClick={(event) => scrollByCardStep(-1, activationMotion(event))}
        disabled={scrollState === 'top' || scrollState === 'none'}
        tabIndex={scrollState === 'middle' || scrollState === 'bottom' ? 0 : -1}
        aria-hidden={scrollState === 'top' || scrollState === 'none'}
      />
      <IconButton
        action="design-card-rail-next"
        className="design-card-rail-next"
        icon={ChevronRight}
        label={nextLabel}
        motion="nudge"
        onClick={(event) => scrollByCardStep(1, activationMotion(event))}
        disabled={scrollState === 'bottom'}
        tabIndex={scrollState === 'none' ? -1 : 0}
        aria-hidden={scrollState === 'none'}
      />
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
};
