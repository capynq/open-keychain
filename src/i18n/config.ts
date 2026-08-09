import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';
import stylesEn from './locales/styles.en.json';
import stylesRu from './locales/styles.ru.json';
import stylesUk from './locales/styles.uk.json';

export const supportedLocales = ['en', 'ru', 'uk'] as const;
export type Locale = (typeof supportedLocales)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en, styles: stylesEn },
      ru: { translation: ru, styles: stylesRu },
      uk: { translation: uk, styles: stylesUk },
    },
    supportedLngs: supportedLocales,
    fallbackLng: 'en',
    load: 'languageOnly',
    ns: ['translation', 'styles'],
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'open-keychain-locale',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    react: { useSuspense: false },
  });

export default i18n;
