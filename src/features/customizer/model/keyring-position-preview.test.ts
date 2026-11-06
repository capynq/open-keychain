import { describe, expect, it } from 'vitest';

import { KEYRING_POSITIONS } from '@/domain/keychain/model/keyring-position';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';

import {
  KEYRING_MARKER_TARGET_PX,
  KEYRING_PREVIEW_ASPECT_RANGE,
  keyringPreviewArtwork,
  keyringPreviewAspect,
  keyringPreviewKey,
  keyringPreviewViewBox,
  layoutKeyringMarkers,
} from './keyring-position-preview';
import { KEYRING_PREVIEW_ARTWORK } from './keyring-preview-artwork';

const keyringDesigns = TEMPLATE_CATALOG.filter((template) => template.supportsKeyring).flatMap(
  (template) =>
    (template.styles.length ? template.styles : (['contour'] as const)).map((styleId) => ({
      templateId: template.id,
      styleId,
    })),
);

describe('keyring position preview', () => {
  it('has generated artwork with every position for each keyring template and style', () => {
    for (const { templateId, styleId } of keyringDesigns) {
      const key = keyringPreviewKey(templateId, styleId);
      expect(KEYRING_PREVIEW_ARTWORK[key], key).toBeDefined();
      const artwork = KEYRING_PREVIEW_ARTWORK[key];
      expect(artwork.body).toMatch(/^M/);
      expect(artwork.relief).toMatch(/^M/);
      for (const position of KEYRING_POSITIONS) {
        expect(artwork.positions[position].tab, `${key}/${position}`).toMatch(/^M/);
        const [x, y] = artwork.positions[position].center;
        const [left, top, width, height] = artwork.bounds;
        expect(x).toBeGreaterThan(left);
        expect(x).toBeLessThan(left + width);
        expect(y).toBeGreaterThan(top);
        expect(y).toBeLessThan(top + height);
      }
    }
  });

  it('draws each style differently and the articulated chain once for all styles', () => {
    expect(keyringPreviewKey('name-keychain', 'ribbon')).toBe('name-keychain/ribbon');
    expect(keyringPreviewKey('articulated-name', 'capsule')).toBe('articulated-name');
    expect(keyringPreviewKey('magnet', 'plain')).toBe('name-keychain/contour');
    expect(keyringPreviewArtwork('name-keychain', 'ribbon')).not.toBe(
      keyringPreviewArtwork('name-keychain', 'capsule'),
    );
  });

  it('places mirrored and articulated end positions on the expected sides', () => {
    const ribbon = keyringPreviewArtwork('name-keychain', 'ribbon').positions;
    expect(Math.abs(ribbon.right.center[1] - ribbon['top-right'].center[1])).toBeGreaterThan(3);
    expect(ribbon.left.center[1]).toBeCloseTo(ribbon.right.center[1], 0);
    const articulated = keyringPreviewArtwork('articulated-name', 'contour').positions;
    expect(articulated.left.center[0]).toBeLessThan(articulated.top.center[0]);
    expect(articulated.right.center[0]).toBeGreaterThan(articulated.top.center[0]);
    expect(articulated['top-right'].center[0]).toBeGreaterThan(articulated.top.center[0]);
  });

  it('keeps the frame proportions within range and the padded artwork inside the view', () => {
    for (const { templateId, styleId } of keyringDesigns) {
      const artwork = keyringPreviewArtwork(templateId, styleId);
      const aspect = keyringPreviewAspect(artwork, 320);
      expect(aspect).toBeGreaterThanOrEqual(KEYRING_PREVIEW_ASPECT_RANGE[0]);
      expect(aspect).toBeLessThanOrEqual(KEYRING_PREVIEW_ASPECT_RANGE[1]);
      const [x, y, width, height] = keyringPreviewViewBox(artwork, aspect, 320);
      expect(width / height).toBeCloseTo(aspect, 6);
      const [left, top, artWidth, artHeight] = artwork.bounds;
      expect(x).toBeLessThan(left);
      expect(y).toBeLessThan(top);
      expect(x + width).toBeGreaterThan(left + artWidth);
      expect(y + height).toBeGreaterThan(top + artHeight);
    }
  });

  it.each([248, 260, 300, 319, 320, 340, 380, 420])(
    'keeps 44 px targets apart and inside a %i px frame',
    (frameWidth) => {
      for (const { templateId, styleId } of keyringDesigns)
        for (const selected of KEYRING_POSITIONS) {
          const artwork = keyringPreviewArtwork(templateId, styleId);
          const aspect = keyringPreviewAspect(artwork, frameWidth);
          const frame = { width: frameWidth, height: frameWidth / aspect };
          const placements = layoutKeyringMarkers(
            artwork,
            keyringPreviewViewBox(artwork, aspect, frameWidth),
            frame,
            selected,
          );
          const label = `${templateId}/${styleId} selected ${selected} at ${frameWidth}px`;
          expect(placements).toHaveLength(KEYRING_POSITIONS.length);
          const half = KEYRING_MARKER_TARGET_PX / 2;
          for (const placement of placements) {
            const x = placement.marker[0] * frame.width;
            const y = placement.marker[1] * frame.height;
            expect(x, label).toBeGreaterThanOrEqual(half - 0.01);
            expect(x, label).toBeLessThanOrEqual(frame.width - half + 0.01);
            expect(y, label).toBeGreaterThanOrEqual(half - 0.01);
            expect(y, label).toBeLessThanOrEqual(frame.height - half + 0.01);
          }
          const chosen = placements.find((placement) => placement.position === selected)!;
          expect(chosen.displaced, label).toBe(false);
          for (let first = 0; first < placements.length; first += 1)
            for (let second = first + 1; second < placements.length; second += 1) {
              const a = placements[first];
              const b = placements[second];
              const apart =
                Math.abs(a.marker[0] - b.marker[0]) * frame.width >= KEYRING_MARKER_TARGET_PX ||
                Math.abs(a.marker[1] - b.marker[1]) * frame.height >= KEYRING_MARKER_TARGET_PX;
              expect(apart, `${label}: ${a.position} and ${b.position}`).toBe(true);
            }
        }
    },
  );
});
