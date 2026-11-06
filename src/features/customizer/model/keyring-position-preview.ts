import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeychainParams } from '@/domain/keychain/model/types';

import { KEYRING_POSITIONS } from '@/domain/keychain/model/keyring-position';

import { KEYRING_PREVIEW_ARTWORK, type KeyringPreviewArtwork } from './keyring-preview-artwork';

/** Frame proportions follow the artwork within this range, so the panel height barely moves. */
export const KEYRING_PREVIEW_ASPECT_RANGE = [2, 2.6] as const;
/** Narrow frames grow taller so six 44 px targets still fit around wide artwork. */
const NARROW_FRAME_PX = 320;
const NARROW_ASPECT = 1.7;
/** Square hit target of every position control, in CSS pixels. */
export const KEYRING_MARKER_TARGET_PX = 44;
/** Frame width assumed before the picker has been measured. */
export const KEYRING_PREVIEW_DEFAULT_WIDTH_PX = 380;

const FALLBACK_KEY = 'name-keychain/contour';

export const keyringPreviewKey = (
  templateId: KeychainParams['templateId'],
  styleId: KeychainParams['styleId'],
): string => {
  const key = templateId === 'articulated-name' ? templateId : `${templateId}/${styleId}`;
  return key in KEYRING_PREVIEW_ARTWORK ? key : FALLBACK_KEY;
};

export const keyringPreviewArtwork = (
  templateId: KeychainParams['templateId'],
  styleId: KeychainParams['styleId'],
): KeyringPreviewArtwork => KEYRING_PREVIEW_ARTWORK[keyringPreviewKey(templateId, styleId)];

export type PreviewViewBox = readonly [number, number, number, number];

/** Width to height of the picker frame for this artwork. */
export const keyringPreviewAspect = (
  artwork: KeyringPreviewArtwork,
  frameWidthPx = KEYRING_PREVIEW_DEFAULT_WIDTH_PX,
): number => {
  if (frameWidthPx < NARROW_FRAME_PX) return NARROW_ASPECT;
  const [, , width, height] = artwork.bounds;
  const [minimum, maximum] = KEYRING_PREVIEW_ASPECT_RANGE;
  return Math.min(maximum, Math.max(minimum, width / Math.max(1, height)));
};

/**
 * Pad the artwork and widen whichever side is short so it fills a frame of the given aspect.
 * The padding leaves half a marker target between every opening and the frame edge.
 */
export const keyringPreviewViewBox = (
  artwork: KeyringPreviewArtwork,
  aspect: number,
  frameWidthPx = KEYRING_PREVIEW_DEFAULT_WIDTH_PX,
): PreviewViewBox => {
  const [x, y, width, height] = artwork.bounds;
  const markerShare = KEYRING_MARKER_TARGET_PX / 2 / Math.max(1, frameWidthPx);
  /* Solve pad = markerShare * paddedWidth, so the marker margin holds at the measured width. */
  const pad = Math.max(2, (markerShare * width) / Math.max(0.2, 1 - markerShare * 2));
  let paddedWidth = width + pad * 2;
  let paddedHeight = height + pad * 2;
  if (paddedWidth / paddedHeight < aspect) paddedWidth = paddedHeight * aspect;
  else paddedHeight = paddedWidth / aspect;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return [centerX - paddedWidth / 2, centerY - paddedHeight / 2, paddedWidth, paddedHeight];
};

export type MarkerPlacement = {
  position: KeyringPosition;
  /** Where the opening really is, as fractions of the frame. */
  anchor: readonly [number, number];
  /** Where the control is drawn, as fractions of the frame. */
  marker: readonly [number, number];
  /** True when the control had to move off its opening to keep targets apart. */
  displaced: boolean;
};

/**
 * Keep every hit target inside the frame and apart from the others. The selected position stays on
 * its opening; others separate along the shorter axis of their overlap, a few pixels at a time.
 */
export const layoutKeyringMarkers = (
  artwork: KeyringPreviewArtwork,
  viewBox: PreviewViewBox,
  frame: { width: number; height: number },
  selected: KeyringPosition,
  targetPx = KEYRING_MARKER_TARGET_PX,
): MarkerPlacement[] => {
  const [viewX, viewY, viewWidth, viewHeight] = viewBox;
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const half = targetPx / 2;
  const clampX = (value: number): number => Math.min(width - half, Math.max(half, value));
  const clampY = (value: number): number => Math.min(height - half, Math.max(half, value));
  const anchors = KEYRING_POSITIONS.map((position) => {
    const [x, y] = artwork.positions[position].center;
    return {
      position,
      x: ((x - viewX) / viewWidth) * width,
      y: ((y - viewY) / viewHeight) * height,
    };
  });
  const markers = anchors.map((anchor) => ({
    ...anchor,
    x: clampX(anchor.x),
    y: clampY(anchor.y),
  }));
  type Marker = (typeof markers)[number];
  const clampAxis = (axis: 'x' | 'y', value: number): number =>
    axis === 'x' ? clampX(value) : clampY(value);
  /*
   * Separate a pair along one axis: a movable marker takes half the move and the other takes
   * whatever the frame edge leaves over. The selected marker never moves.
   */
  const separate = (a: Marker, b: Marker, axis: 'x' | 'y', direction: number, needed: number) => {
    const aMovable = a.position !== selected;
    const bMovable = b.position !== selected;
    const aShare = aMovable ? (bMovable ? needed / 2 : needed) : 0;
    let aNext = clampAxis(axis, a[axis] - direction * aShare);
    const remaining = needed - Math.abs(aNext - a[axis]);
    let bNext = bMovable ? clampAxis(axis, b[axis] + direction * remaining) : b[axis];
    const leftover = needed - Math.abs(aNext - a[axis]) - Math.abs(bNext - b[axis]);
    if (leftover > 0 && aMovable) aNext = clampAxis(axis, aNext - direction * leftover);
    if (!bMovable) bNext = b[axis];
    return {
      aNext,
      bNext,
      progress: Math.min(1, (Math.abs(aNext - a[axis]) + Math.abs(bNext - b[axis])) / needed),
    };
  };
  for (let iteration = 0; iteration < 120; iteration += 1) {
    let moved = false;
    for (let first = 0; first < markers.length; first += 1)
      for (let second = first + 1; second < markers.length; second += 1) {
        const a = markers[first];
        const b = markers[second];
        const overlapX = targetPx - Math.abs(b.x - a.x);
        const overlapY = targetPx - Math.abs(b.y - a.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        /* Prefer the axis the frame edges let the pair separate along, then the shorter move. */
        const [choice] = (['x', 'y'] as const)
          .map((axis) => {
            const needed = (axis === 'x' ? overlapX : overlapY) + 0.5;
            const direction = Math.sign(b[axis] - a[axis]) || 1;
            return { axis, needed, ...separate(a, b, axis, direction, needed) };
          })
          .sort((left, right) => right.progress - left.progress || left.needed - right.needed);
        a[choice.axis] = choice.aNext;
        b[choice.axis] = choice.bNext;
      }
    if (!moved) break;
  }
  return markers.map((marker, index) => {
    const anchor = anchors[index];
    return {
      position: marker.position,
      anchor: [anchor.x / width, anchor.y / height],
      marker: [marker.x / width, marker.y / height],
      displaced: Math.hypot(marker.x - anchor.x, marker.y - anchor.y) > 3,
    };
  });
};
