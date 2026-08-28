import { useId, useRef } from 'react';
import './DesignSelectCard.module.css';

export type DesignSelectCardProps = {
  title: string;
  accessibleLabel?: string;
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
  accessibleLabel,
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
      aria-label={accessibleLabel ?? title}
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
      {(accessibleLabel || description) && (
        <span id={descriptionId} className="sr-only">
          {accessibleLabel ? `${title}${description ? `. ${description}` : ''}` : description}
        </span>
      )}
    </button>
  );
};
