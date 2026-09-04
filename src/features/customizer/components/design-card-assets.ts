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
    contour: '/showcase/styles/name-keychain-contour.png',
    capsule: '/showcase/styles/name-keychain-capsule.png',
    'soft-tag': '/showcase/styles/name-keychain-soft-tag.png',
    bubble: '/showcase/styles/name-keychain-bubble.png',
    arch: '/showcase/styles/name-keychain-arch.png',
    'heart-split': '/showcase/styles/name-keychain-heart-split.png',
  },
  'plant-label': {
    contour: '/showcase/styles/plant-label-contour.png',
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
    ribbon: '/showcase/styles/magnet-ribbon.png',
  },
};

export const stylePreviewAsset = (templateId: TemplateId, styleId: StyleId): string =>
  STYLE_PREVIEW_ASSETS[templateId]?.[styleId] ?? TEMPLATE_PREVIEW_ASSETS[templateId];
