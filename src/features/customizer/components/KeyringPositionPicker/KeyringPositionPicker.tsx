import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeychainParams } from '@/domain/keychain/model/types';
import type { Locale } from '@/infrastructure/i18n';

import { keyringPositionNameKey } from '@/domain/keychain/model/keyring-position';
import {
  KEYRING_PREVIEW_DEFAULT_WIDTH_PX,
  keyringPreviewArtwork,
  keyringPreviewAspect,
  keyringPreviewViewBox,
  layoutKeyringMarkers,
} from '@/features/customizer/model/keyring-position-preview';
import { t } from '@/infrastructure/i18n';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import styles from './KeyringPositionPicker.module.css';

const percent = (value: number): string => `${(value * 100).toFixed(3)}%`;

type FrameSize = { width: number; height?: number };

/** Track the rendered frame so marker spacing holds at every sidebar and dialog size. */
const useFrameSize = (): [React.RefObject<HTMLDivElement | null>, FrameSize] => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<FrameSize>({ width: KEYRING_PREVIEW_DEFAULT_WIDTH_PX });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0) return;
      setSize((current) =>
        Math.abs(current.width - width) < 1 && Math.abs((current.height ?? 0) - height) < 1
          ? current
          : { width, height: height > 0 ? height : undefined },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
};

export const KeyringPositionPicker = ({
  locale,
  selected,
  templateId = 'name-keychain',
  styleId = 'contour',
  variant = 'editor',
  onSelect,
}: {
  locale: Locale;
  selected: KeyringPosition;
  templateId?: KeychainParams['templateId'];
  styleId?: KeychainParams['styleId'];
  variant?: 'editor' | 'setup';
  onSelect: (position: KeyringPosition) => void;
}) => {
  const { track } = useAnalytics();
  const [frameRef, frameSize] = useFrameSize();
  const frameWidth = frameSize.width;
  const [previewed, setPreviewed] = useState<KeyringPosition>();
  const artwork = keyringPreviewArtwork(templateId, styleId);
  const aspect = keyringPreviewAspect(artwork, frameWidth);
  const viewBox = useMemo(
    () => keyringPreviewViewBox(artwork, aspect, frameWidth),
    [artwork, aspect, frameWidth],
  );
  /* The measured height lags one frame behind an aspect change; fall back to the target ratio. */
  const measuredHeight = frameSize.height;
  const frame = {
    width: frameWidth,
    height:
      measuredHeight && Math.abs(measuredHeight - frameWidth / aspect) < 4
        ? measuredHeight
        : frameWidth / aspect,
  };
  const placements = layoutKeyringMarkers(artwork, viewBox, frame, selected);
  const hinted = previewed && previewed !== selected ? previewed : undefined;

  return (
    <fieldset className={styles.picker}>
      <legend>{t(locale, 'keyringPosition')}</legend>
      <div
        ref={frameRef}
        className={styles.illustration}
        data-testid="keyring-position-diagram"
        data-preview-artwork={templateId === 'articulated-name' ? templateId : styleId}
        style={{ aspectRatio: `${aspect.toFixed(3)} / 1` }}
        onPointerLeave={() => setPreviewed(undefined)}
      >
        <svg
          aria-hidden="true"
          className={styles.artwork}
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
          viewBox={viewBox.join(' ')}
        >
          {hinted && (
            <path
              className={styles.hintTab}
              d={artwork.positions[hinted].tab}
              data-keyring-tab="hint"
              data-position={hinted}
              fillRule="evenodd"
            />
          )}
          <path
            className={styles.selectedTab}
            d={artwork.positions[selected].tab}
            data-keyring-tab="selected"
            data-position={selected}
            fillRule="evenodd"
          />
          <path className={styles.body} d={artwork.body} fillRule="evenodd" />
          <path className={styles.relief} d={artwork.relief} fillRule="evenodd" />
        </svg>
        <svg aria-hidden="true" className={styles.leaders} focusable="false">
          {placements
            .filter((placement) => placement.displaced)
            .map((placement) => (
              <line
                key={placement.position}
                x1={percent(placement.anchor[0])}
                y1={percent(placement.anchor[1])}
                x2={percent(placement.marker[0])}
                y2={percent(placement.marker[1])}
              />
            ))}
        </svg>

        {placements.map(({ position, marker, displaced }) => (
          <label
            className={styles.option}
            data-displaced={displaced}
            data-position={position}
            key={position}
            style={{ left: percent(marker[0]), top: percent(marker[1]) }}
            title={t(locale, keyringPositionNameKey(position))}
            onPointerEnter={() => setPreviewed(position)}
          >
            <input
              type="radio"
              name={`keyring-position-${variant}`}
              data-candidate-key="keyringPosition"
              value={position}
              checked={selected === position}
              onFocus={() => setPreviewed(position)}
              onBlur={() => setPreviewed(undefined)}
              onChange={() => {
                onSelect(position);
                track('customizer_option_changed', {
                  family: 'keyring_position',
                  option_id: position,
                });
              }}
            />
            <span aria-hidden="true" className={styles.marker}>
              <span className={styles.hole} />
            </span>
            <span className={styles.visuallyHidden}>
              {t(locale, keyringPositionNameKey(position))}
            </span>
          </label>
        ))}
      </div>
      <p
        aria-hidden="true"
        className={styles.selectedPosition}
        data-testid="keyring-position-current"
      >
        {t(locale, keyringPositionNameKey(selected))}
      </p>
    </fieldset>
  );
};
