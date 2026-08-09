import type { TFunction } from 'i18next';
import i18n from './config';
import type { Locale } from './config';

export type { Locale } from './config';

const keyByIssueCode: Record<string, string> = {
  'empty-text': 'errorEmptyText',
  'text-too-long': 'errorTooLong',
  'font-load': 'errorFontLoad',
  'missing-glyph': 'errorMissingGlyph',
  'empty-outline': 'errorEmptyOutline',
  'text-too-wide': 'errorTooWide',
  disconnected: 'errorDisconnected',
  'scaled-to-fit': 'warningScaled',
  'dense-mesh': 'warningDense',
  'shallow-relief': 'warningShallow',
};

export function detectLocale(): Locale {
  const language = i18n.resolvedLanguage ?? i18n.language;
  return language.startsWith('uk') ? 'uk' : language.startsWith('ru') ? 'ru' : 'en';
}

export function setLocale(locale: Locale): Promise<void> {
  return i18n.changeLanguage(locale).then(() => undefined);
}

export function t(locale: Locale, key: string, variables: Record<string, string | number> = {}): string {
  return i18n.getFixedT(locale, 'translation')(key, variables);
}

export function issueMessage(locale: Locale, issue: { code: string; message: string }): string {
  const key = keyByIssueCode[issue.code];
  if (!key) return issue.message;
  const translate: TFunction = i18n.getFixedT(locale, 'translation');
  return translate(key, {
    glyph: issue.message.match(/[“«]([^”»]+)[”»]/)?.[1] ?? '',
    height: issue.message.match(/to ([\d.]+) mm/)?.[1] ?? '',
  });
}

export function styleName(locale: Locale, styleId: string, fallback: string): string {
  const translate: TFunction = i18n.getFixedT(locale, 'styles');
  return translate(styleId, { defaultValue: fallback });
}
