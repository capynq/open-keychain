import { describe, expect, it } from 'vitest';

import { HERO_IMAGE_SOURCES, heroImagePreloadTags } from './hero-image';

describe('hero image preloads', () => {
  it('preload exactly the AVIF sources, with the sizes the picture uses', () => {
    const tags = heroImagePreloadTags();
    const avif = HERO_IMAGE_SOURCES.filter((source) => source.type === 'image/avif');

    expect(tags.match(/<link /g)).toHaveLength(avif.length);
    for (const source of avif) {
      expect(tags).toContain(`imagesrcset="${source.srcSet}" imagesizes="${source.sizes}"`);
    }
  });

  it('give every device exactly one preload', () => {
    expect(HERO_IMAGE_SOURCES.map((source) => source.preloadMedia).filter(Boolean)).toEqual([
      '(max-width: 760px) and (min-resolution: 2dppx)',
      '(max-width: 760px) and (max-resolution: 1.99dppx)',
      '(min-width: 761px)',
    ]);
  });
});
