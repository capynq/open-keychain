import { describe, expect, it } from 'vitest';

import { photoFilename, type PhotoDesign } from './photo-filename';

const design: PhotoDesign = { text: 'ALEX', templateId: 'name-keychain', styleId: 'contour' };

describe('photoFilename', () => {
  it('includes the text, template, style, resolution and selected extension', () => {
    expect(photoFilename(design, 2048, 'jpg')).toBe('alex-name-keychain-contour-2048px.jpg');
    expect(photoFilename(design, 1024, 'png')).toBe('alex-name-keychain-contour-1024px.png');
  });

  it('cleans separators while preserving accents and non-Latin names', () => {
    expect(photoFilename({ ...design, text: ' Émilie / Jo: ? ' }, 1024, 'png')).toBe(
      'émilie-jo-name-keychain-contour-1024px.png',
    );
    expect(photoFilename({ ...design, text: 'Андрій' }, 1024, 'png')).toBe(
      'андрій-name-keychain-contour-1024px.png',
    );
  });

  it('uses a fallback for empty names and bounds long names', () => {
    expect(photoFilename({ ...design, text: ' / ' }, 4096, 'png')).toBe(
      'name-name-keychain-contour-4096px.png',
    );
    expect(photoFilename({ ...design, text: 'a'.repeat(200) }, 1024, 'png')).toBe(
      `${'a'.repeat(48)}-name-keychain-contour-1024px.png`,
    );
  });

  it('omits retained styles for templates without a backing style', () => {
    for (const templateId of ['nameplate', 'articulated-name'] as const) {
      expect(photoFilename({ ...design, templateId }, 1024, 'png')).toBe(
        `alex-${templateId}-1024px.png`,
      );
    }
  });
});
