import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';
import stylesEn from './locales/styles.en.json';
import stylesRu from './locales/styles.ru.json';
import stylesUk from './locales/styles.uk.json';

export type Locale = 'en' | 'ru' | 'uk';
export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const dictionaries: Record<Locale, Messages> = { en, ru, uk };
const styleDictionaries: Record<Locale, Record<string, string>> = { en: stylesEn, ru: stylesRu, uk: stylesUk };

export function detectLocale(): Locale {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('open-keychain-locale') : null;
  if (saved === 'en' || saved === 'ru' || saved === 'uk') return saved;
  const language = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  return language.startsWith('uk') ? 'uk' : language.startsWith('ru') ? 'ru' : 'en';
}

export function t(locale: Locale, key: MessageKey, variables: Record<string, string | number> = {}): string {
  return dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, variable: string) => String(variables[variable] ?? `{${variable}}`));
}

export function issueMessage(locale: Locale, issue: { code: string; message: string }): string {
  const keyByCode: Record<string, MessageKey> = {
    'empty-text': 'errorEmptyText', 'text-too-long': 'errorTooLong', 'font-load': 'errorFontLoad', 'missing-glyph': 'errorMissingGlyph', 'empty-outline': 'errorEmptyOutline', 'text-too-wide': 'errorTooWide', disconnected: 'errorDisconnected', 'scaled-to-fit': 'warningScaled', 'dense-mesh': 'warningDense', 'shallow-relief': 'warningShallow',
  };
  const key = keyByCode[issue.code];
  return key ? t(locale, key, { glyph: issue.message.match(/[“«]([^”»]+)[”»]/)?.[1] ?? '', height: issue.message.match(/to ([\d.]+) mm/)?.[1] ?? '' }) : issue.message;
}

export function styleName(locale: Locale, styleId: string, fallback: string): string {
  return styleDictionaries[locale][styleId] ?? fallback;
}
