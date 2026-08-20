import { useId, useRef, type ReactNode } from 'react';

export type DesignSelectCardProps = {
  title: string;
  description?: string;
  previewSrc: string;
  selected: boolean;
  onSelect: () => void;
  guideTarget?: string;
  testId?: string;
};

/** A compact, image-led choice that works for both templates and styles. */
export const DesignSelectCard = ({
  title,
  description,
  previewSrc,
  selected,
  onSelect,
  guideTarget,
  testId,
}: DesignSelectCardProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();

  const keepInView = (): void => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    buttonRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`design-select-card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      aria-label={title}
      aria-describedby={description ? descriptionId : undefined}
      data-guide-target={guideTarget}
      data-testid={testId}
      onClick={onSelect}
      onFocus={keepInView}
    >
      <img src={previewSrc} alt="" aria-hidden="true" />
      <span className="design-select-card-overlay" aria-hidden="true" />
      <span className="design-select-card-copy">
        <strong>{title}</strong>
        {description && <span className="design-select-card-description">{description}</span>}
      </span>
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </button>
  );
};

export type DesignCardRailProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export const DesignCardRail = ({ label, className, children }: DesignCardRailProps) => {
  const railRef = useRef<HTMLDivElement>(null);

  return (
    <div className="design-card-rail-shell" data-scroll-state="top">
      <div
        ref={railRef}
        className={`design-card-rail${className ? ` ${className}` : ''}`}
        aria-label={label}
        onScroll={(event) => {
          const rail = event.currentTarget;
          const atStart = rail.scrollLeft <= 1;
          const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
          const shell = rail.parentElement;
          shell?.setAttribute(
            'data-scroll-state',
            atStart ? (atEnd ? 'none' : 'top') : atEnd ? 'bottom' : 'middle',
          );
        }}
      >
        {children}
      </div>
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
};
