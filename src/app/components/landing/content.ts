import type { TemplateId } from '../../../domain/keychain';
import { templateCreatePath as sharedTemplateCreatePath } from '../../../shared/lib/create-path';

export { createPath } from '../../../shared/lib/create-path';

export const HOW_IT_WORKS = ['name', 'shape', 'export'] as const;
export const SUPPORTED_PRODUCTS = ['keychain', 'articulated', 'nameplate', 'plantLabel'] as const;
export const RUN_OPTIONS = ['browser', 'selfHost', 'hosted'] as const;
export const RUN_ITEMS = [0, 1, 2] as const;

export type TemplateShowcase = {
  id: TemplateId;
  assetPath: string;
  titleKey: string;
  bodyKey: string;
  altKey: string;
};

export const templateCreatePath = (locale: string, templateId: TemplateId): string =>
  sharedTemplateCreatePath(locale, templateId);

export const TEMPLATE_SHOWCASE: readonly TemplateShowcase[] = [
  {
    id: 'name-keychain',
    assetPath: '/showcase/templates/name-keychain.png',
    titleKey: 'landing.products.keychain.title',
    bodyKey: 'landing.products.keychain.body',
    altKey: 'landing.templatePreviewAlt.nameKeychain',
  },
  {
    id: 'articulated-name',
    assetPath: '/showcase/templates/articulated-name.png',
    titleKey: 'landing.products.articulated.title',
    bodyKey: 'landing.products.articulated.body',
    altKey: 'landing.templatePreviewAlt.articulatedName',
  },
  {
    id: 'nameplate',
    assetPath: '/showcase/templates/nameplate.png',
    titleKey: 'landing.products.nameplate.title',
    bodyKey: 'landing.products.nameplate.body',
    altKey: 'landing.templatePreviewAlt.nameplate',
  },
  {
    id: 'plant-label',
    assetPath: '/showcase/templates/plant-label.png',
    titleKey: 'landing.products.plantLabel.title',
    bodyKey: 'landing.products.plantLabel.body',
    altKey: 'landing.templatePreviewAlt.plantLabel',
  },
];

export type HowItWorksStep = (typeof HOW_IT_WORKS)[number];
export type SupportedProduct = (typeof SUPPORTED_PRODUCTS)[number];
export type RunOption = (typeof RUN_OPTIONS)[number];
