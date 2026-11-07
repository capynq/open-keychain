/**
 * The landing hero screenshot: one list drives both the `<picture>` sources and the preloads in
 * the landing document, so a preload can never name a different file than the picture chooses.
 * Sources are in `<picture>` order; `preloadMedia` restates each AVIF source's own condition
 * minus the ones before it, which is when the browser picks that source.
 */
export type HeroImageSource = {
  type?: 'image/avif' | 'image/webp';
  media?: string;
  srcSet: string;
  sizes: string;
  preloadMedia?: string;
};

const MOBILE = '(max-width: 760px)';
const MOBILE_2X = `${MOBILE} and (min-resolution: 2dppx)`;
const MOBILE_SIZES = 'calc(100vw - 50px)';
const DESKTOP_SIZES = '(max-width: 760px) 100vw, 50vw';
const v1 = (name: string) => `/showcase/v1/${name}`;

export const HERO_IMAGE_SOURCES: readonly HeroImageSource[] = [
  {
    type: 'image/avif',
    media: MOBILE_2X,
    srcSet: `${v1('create-mobile-780.avif')} 780w`,
    sizes: MOBILE_SIZES,
    preloadMedia: MOBILE_2X,
  },
  {
    type: 'image/avif',
    media: MOBILE,
    srcSet: `${v1('create-mobile-390.avif')} 390w, ${v1('create-mobile-490.avif')} 490w`,
    sizes: MOBILE_SIZES,
    preloadMedia: `${MOBILE} and (max-resolution: 1.99dppx)`,
  },
  {
    type: 'image/avif',
    srcSet: `${v1('create-desktop-720.avif')} 720w, ${v1('create-desktop-1440.avif')} 1440w`,
    sizes: DESKTOP_SIZES,
    preloadMedia: '(min-width: 761px)',
  },
  {
    type: 'image/webp',
    media: MOBILE_2X,
    srcSet: `${v1('create-mobile-780.webp')} 780w`,
    sizes: MOBILE_SIZES,
  },
  {
    type: 'image/webp',
    media: MOBILE,
    srcSet: `${v1('create-mobile-390.webp')} 390w, ${v1('create-mobile-490.webp')} 490w`,
    sizes: MOBILE_SIZES,
  },
  {
    type: 'image/webp',
    srcSet: `${v1('create-desktop-720.webp')} 720w, ${v1('create-desktop-1440.webp')} 1440w`,
    sizes: DESKTOP_SIZES,
  },
  {
    media: MOBILE,
    srcSet: '/showcase/create-mobile.png 1x, /showcase/create-mobile@2x.png 2x',
    sizes: MOBILE_SIZES,
  },
];

export const HERO_IMAGE_FALLBACK = {
  src: '/showcase/create-desktop.png',
  srcSet: '/showcase/create-desktop.png 1x',
  sizes: `${MOBILE} ${MOBILE_SIZES}, 50vw`,
  width: 1440,
  height: 900,
} as const;

const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Early, high-priority preloads for the AVIF the hero picture will select on this device. */
export const heroImagePreloadTags = (): string =>
  HERO_IMAGE_SOURCES.filter((source) => source.preloadMedia)
    .map(
      (source) =>
        `<link rel="preload" as="image" type="${source.type}" fetchpriority="high" ` +
        `imagesrcset="${attribute(source.srcSet)}" imagesizes="${attribute(source.sizes)}" ` +
        `media="${attribute(source.preloadMedia!)}">`,
    )
    .join('');
