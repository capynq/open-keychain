import { useId, useRef } from 'react';

import { DESIGN_CARD_IMAGE_SIZES, designCardImageSources } from '../design-card-assets';
import styles from './DesignSelectCard.module.css';

export type DesignSelectCardProps = {
  title: string;
  accessibleLabel?: string;
  description?: string;
  previewSrc: string;
  selected: boolean;
  onSelect: () => void;
  guideTarget?: string;
  testId?: string;
  candidateKey?: string;
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
  candidateKey,
}: DesignSelectCardProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const sources = designCardImageSources(previewSrc);

  const keepInView = (): void => {
    buttonRef.current?.scrollIntoView?.({
      behavior: 'instant',
      block: 'nearest',
      inline: 'nearest',
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${styles['design-select-card-root-marker']} design-select-card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      aria-label={accessibleLabel ?? title}
      aria-describedby={description ? descriptionId : undefined}
      data-guide-target={guideTarget}
      data-testid={testId}
      data-candidate-key={candidateKey}
      onClick={onSelect}
      onFocus={keepInView}
    >
      <picture className={styles.picture}>
        {sources && (
          <>
            <source type="image/avif" srcSet={sources.avif} sizes={DESIGN_CARD_IMAGE_SIZES} />
            <source type="image/webp" srcSet={sources.webp} sizes={DESIGN_CARD_IMAGE_SIZES} />
          </>
        )}
        <img
          src={previewSrc}
          alt=""
          aria-hidden="true"
          width="1280"
          height="720"
          loading="lazy"
          decoding="async"
        />
      </picture>
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
