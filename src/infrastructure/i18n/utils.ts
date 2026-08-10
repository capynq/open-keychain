import type { TFunction } from 'i18next';
import i18n from './config';
import type { Locale } from './config';
export type { Locale } from './config';
const keyByIssueCode: Record<string, string> = {
  'empty-text': 'errorEmptyText',
  'text-too-long': 'errorTooLong',
  'font-load': 'errorFontLoad',
  'missing-glyph': 'errorMissingGlyph',
  'articulated-font': 'errorArticulatedFont',
  'empty-outline': 'errorEmptyOutline',
  'text-too-wide': 'errorTooWide',
  disconnected: 'errorDisconnected',
  'relief-outside-backing': 'errorReliefOutsideBacking',
  'nameplate-text-outside-plate': 'errorNameplateTextOutside',
  'nameplate-embedding': 'errorNameplateEmbedding',
  'scaled-to-fit': 'warningScaled',
  'dense-mesh': 'warningDense',
  'shallow-relief': 'warningShallow',
  'articulated-base-adjusted': 'warningArticulatedBaseAdjusted',
  'articulated-captive': 'errorArticulatedJoint',
  'articulated-counter': 'errorArticulatedJoint',
  'articulated-manifold': 'errorArticulatedJoint',
  'articulated-body-collision': 'errorArticulatedJoint',
  'articulated-connector-collision': 'errorArticulatedJoint',
  'articulated-motion-collision': 'errorArticulatedJoint',
};
export const detectLocale = (): Locale => {
  const language = i18n.resolvedLanguage ?? i18n.language;
  return language.startsWith('uk') ? 'uk' : language.startsWith('ru') ? 'ru' : 'en';
};
export const setLocale = (locale: Locale): Promise<void> => {
  return i18n.changeLanguage(locale).then(() => undefined);
};
export const t = (
  locale: Locale,
  key: string,
  variables: Record<string, string | number> = {},
): string => {
  return i18n.getFixedT(locale, 'translation')(key, variables);
};
export const issueMessage = (
  locale: Locale,
  issue: {
    code: string;
    message: string;
  },
): string => {
  const key = keyByIssueCode[issue.code];
  if (!key) return issue.message;
  const translate: TFunction = i18n.getFixedT(locale, 'translation');
  return translate(key, {
    glyph: issue.message.match(/[“«]([^”»]+)[”»]/)?.[1] ?? '',
    height: issue.message.match(/to ([\d.]+) mm/)?.[1] ?? '',
  });
};
export const styleName = (locale: Locale, styleId: string, fallback: string): string => {
  const translate: TFunction = i18n.getFixedT(locale, 'styles');
  return translate(styleId, { defaultValue: fallback });
};
export const templateName = (locale: Locale, templateId: string, fallback: string): string => {
  const translate: TFunction = i18n.getFixedT(locale, 'templates');
  return translate(templateId, { defaultValue: fallback });
};
