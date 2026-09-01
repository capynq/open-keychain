import type { Locale } from '../../../infrastructure/i18n/config';

import i18n from '../../../infrastructure/i18n/config';

export const localizedObjects = <T>(locale: Locale, key: string): T[] => {
  const value = i18n.getFixedT(locale, 'translation')(key, { returnObjects: true });

  return Array.isArray(value) ? (value as T[]) : [];
};

export const templateTranslationKey = (templateId: string): string => {
  switch (templateId) {
    case 'name-keychain':
      return 'nameKeychain';
    case 'articulated-name':
      return 'articulatedName';
    case 'plant-label':
      return 'plantLabel';
    default:
      return 'nameplate';
  }
};
