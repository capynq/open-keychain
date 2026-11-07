import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/resources.en';
export const supportedLocales = ['en', 'ru', 'uk'] as const;
export type Locale = (typeof supportedLocales)[number];
type LocaleResources = Record<keyof typeof en, object>;

/*
 * English ships with the entry: `/` renders it and every locale falls back to it. Russian and
 * Ukrainian are separate chunks, loaded before the first render that shows them (`main.tsx`,
 * `useLoadedLocale`); the document preloads the one its resolver picks.
 */
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: LocaleResources }>> = {
  ru: () => import('./locales/resources.ru'),
  uk: () => import('./locales/resources.uk'),
};
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en },
    supportedLngs: supportedLocales,
    fallbackLng: 'en',
    load: 'languageOnly',
    ns: ['translation', 'styles', 'templates'],
    defaultNS: 'translation',
    detection: {
      order: ['navigator'],
      caches: [],
    },
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    react: { useSuspense: false },
  });

export const isLocaleLoaded = (locale: Locale): boolean =>
  i18n.hasResourceBundle(locale, 'translation');

/** Loads a locale's strings once; concurrent callers share the request, a failure can retry. */
export const loadLocale = (locale: Locale): Promise<void> => {
  if (locale === 'en' || isLocaleLoaded(locale)) return Promise.resolve();
  const inFlight = pending.get(locale);
  if (inFlight) return inFlight;
  const request = loaders[locale]()
    .then(({ default: resources }) => {
      for (const [namespace, bundle] of Object.entries(resources))
        i18n.addResourceBundle(locale, namespace, bundle);
      listeners.forEach((listener) => listener());
    })
    .finally(() => pending.delete(locale));
  pending.set(locale, request);
  return request;
};

/** Notifies after any locale finishes loading. */
export const subscribeLocaleLoads = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export default i18n;
