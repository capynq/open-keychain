import en from './i18n/locales/en.json';
import ru from './i18n/locales/ru.json';
import uk from './i18n/locales/uk.json';

export type Locale = 'en' | 'ru' | 'uk';
export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const dictionaries: Record<Locale, Messages> = { en, ru, uk };

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
