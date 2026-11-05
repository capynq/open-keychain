import type { TFunction } from 'i18next';

import type { RecoveryFailure } from '../../shared/lib/recovery/failure';
import type { Locale } from './config';

import { recoveryDefinition } from '../../shared/lib/recovery/catalog';
import i18n from './config';
export type { Locale } from './config';
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
  const failure = { code: issue.code, message: issue.message } satisfies RecoveryFailure;
  return recoveryMessage(locale, failure);
};
const recoveryVariables = (failure: RecoveryFailure): Record<string, string | number> => ({
  glyph: failure.message?.match(/[“«]([^”»]+)[”»]/)?.[1] ?? '',
  height: failure.message?.match(/(?:to|remains) ([\d.]+) mm/)?.[1] ?? '',
  width: failure.message?.match(/is ([\d.]+) mm wide/)?.[1] ?? '',
  target: failure.context?.target ?? '',
  profile: failure.context?.profile ?? '',
  maximumMm: failure.context?.maximumMm ?? '',
  requestedMm: failure.context?.requestedMm ?? '',
});
/* Engine messages do not always carry both measurements; pick wording that only names known values. */
const messageKeyFor = (
  code: string,
  messageKey: string,
  variables: Record<string, string | number>,
): string => {
  if (code !== 'text-over-width' || (variables.height !== '' && variables.width !== ''))
    return messageKey;
  return variables.width !== '' ? 'warningTextOverWidthAtMinimum' : 'warningTextOverWidthGeneric';
};
export const recoveryMessage = (locale: Locale, failure: RecoveryFailure): string => {
  const definition = recoveryDefinition(failure.code);
  const translate: TFunction = i18n.getFixedT(locale, 'translation');
  const variables = recoveryVariables(failure);
  return translate(messageKeyFor(failure.code, definition.messageKey, variables), variables);
};
export const recoverySteps = (locale: Locale, failure: RecoveryFailure): string => {
  const stepsKey = recoveryDefinition(failure.code).stepsKey;
  if (!stepsKey) return '';
  return i18n.getFixedT(locale, 'translation')(stepsKey, recoveryVariables(failure));
};
export const styleName = (locale: Locale, styleId: string, fallback: string): string => {
  const translate: TFunction = i18n.getFixedT(locale, 'styles');
  return translate(styleId, { defaultValue: fallback });
};
export const styleDescription = (locale: Locale, styleId: string, fallback: string): string => {
  const translate: TFunction = i18n.getFixedT(locale, 'styles');
  return translate(`${styleId}.description`, { defaultValue: fallback });
};
export const templateName = (locale: Locale, templateId: string, fallback: string): string => {
  const translate: TFunction = i18n.getFixedT(locale, 'templates');
  return translate(templateId, { defaultValue: fallback });
};
export const templateDescription = (locale: Locale, templateId: string, fallback: string): string =>
  t(locale, `templateDescriptions.${templateId}`) || fallback;
