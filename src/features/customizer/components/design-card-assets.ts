import type { StyleId, TemplateId } from '../../../domain/keychain/model/types';

export const TEMPLATE_PREVIEW_ASSETS: Record<TemplateId, string> = {
  'name-keychain': '/showcase/templates/name-keychain.png',
  'articulated-name': '/showcase/templates/articulated-name.png',
  nameplate: '/showcase/templates/nameplate.png',
  'plant-label': '/showcase/templates/plant-label.png',
  magnet: '/showcase/templates/magnet.png',
};

export const STYLE_PREVIEW_ASSETS: Partial<Record<TemplateId, Partial<Record<StyleId, string>>>> = {
  'name-keychain': {
    /* The default style is the template render itself: one URL, one download. */
    contour: TEMPLATE_PREVIEW_ASSETS['name-keychain'],
    capsule: '/showcase/styles/name-keychain-capsule.png',
    'soft-tag': '/showcase/styles/name-keychain-soft-tag.png',
    bubble: '/showcase/styles/name-keychain-bubble.png',
    arch: '/showcase/styles/name-keychain-arch.png',
    'heart-split': '/showcase/styles/name-keychain-heart-split.png',
  },
  'plant-label': {
    contour: TEMPLATE_PREVIEW_ASSETS['plant-label'],
    capsule: '/showcase/styles/plant-label-capsule.png',
    'soft-tag': '/showcase/styles/plant-label-soft-tag.png',
    bubble: '/showcase/styles/plant-label-bubble.png',
    arch: '/showcase/styles/plant-label-arch.png',
  },
  magnet: {
    plain: '/showcase/templates/magnet.png',
    contour: '/showcase/styles/magnet-contour.png',
    capsule: '/showcase/styles/magnet-capsule.png',
    'soft-tag': '/showcase/styles/magnet-soft-tag.png',
    bubble: '/showcase/styles/magnet-bubble.png',
    arch: '/showcase/styles/magnet-arch.png',
    ribbon: TEMPLATE_PREVIEW_ASSETS.magnet,
  },
};

export const stylePreviewAsset = (templateId: TemplateId, styleId: StyleId): string =>
  STYLE_PREVIEW_ASSETS[templateId]?.[styleId] ?? TEMPLATE_PREVIEW_ASSETS[templateId];

const CARD_WIDTHS = [240, 480, 720] as const;

/**
 * What a card image decodes at: cards are a third of the phone width, about 300 px on tablets
 * and under 190 px on desktop, and their 16:9 renders are cropped to cover them.
 */
export const DESIGN_CARD_IMAGE_SIZES =
  '(max-width: 760px) calc((100vw - 64px) * 0.45), (max-width: 900px) 350px, 190px';

/** AVIF and WebP derivatives from `pnpm assets:landing` for a design card's PNG. */
export const designCardImageSources = (src: string): { avif: string; webp: string } | undefined => {
  const match = /^\/showcase\/(templates|styles)\/([\w-]+)\.png$/.exec(src);
  if (!match) return undefined;
  const base = `/showcase/v1/cards/${match[1]}/${match[2]}`;
  const srcSet = (format: 'avif' | 'webp') =>
    CARD_WIDTHS.map((width) => `${base}-${width}.${format} ${width}w`).join(', ');
  return { avif: srcSet('avif'), webp: srcSet('webp') };
};
