import type { Locale } from '../../../infrastructure/i18n/config';

export type Faq = { question: string; answer: string };

export type SeoCtaClick = (locale: Locale, cta: string) => void;

export type SeoLocaleChange = (locale: Locale) => void;
