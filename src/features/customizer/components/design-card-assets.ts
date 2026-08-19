import type { StyleId, TemplateId } from '../../../domain/keychain';

export const TEMPLATE_PREVIEW_ASSETS: Record<TemplateId, string> = {
  'name-keychain': '/showcase/templates/name-keychain.png',
  'articulated-name': '/showcase/templates/articulated-name.png',
  nameplate: '/showcase/templates/nameplate.png',
  'plant-label': '/showcase/templates/plant-label.png',
};

// These previews are deliberately static ALEX captures. They make the rail fast and
// deterministic while the live viewer remains responsible for the current design.
export const STYLE_PREVIEW_ASSETS: Partial<Record<TemplateId, Record<StyleId, string>>> = {
  'name-keychain': {
    contour: '/showcase/styles/name-keychain-contour.png',
    capsule: '/showcase/styles/name-keychain-capsule.png',
    'soft-tag': '/showcase/styles/name-keychain-soft-tag.png',
    bubble: '/showcase/styles/name-keychain-bubble.png',
    arch: '/showcase/styles/name-keychain-arch.png',
  },
  'plant-label': {
    contour: '/showcase/styles/plant-label-contour.png',
    capsule: '/showcase/styles/plant-label-capsule.png',
    'soft-tag': '/showcase/styles/plant-label-soft-tag.png',
    bubble: '/showcase/styles/plant-label-bubble.png',
    arch: '/showcase/styles/plant-label-arch.png',
  },
};

export const stylePreviewAsset = (templateId: TemplateId, styleId: StyleId): string =>
  STYLE_PREVIEW_ASSETS[templateId]?.[styleId] ?? TEMPLATE_PREVIEW_ASSETS[templateId];
