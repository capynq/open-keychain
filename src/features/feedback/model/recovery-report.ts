import type { RecoveryFailure } from '@/shared/lib/recovery/failure';
import type { RecoveryNoticeReport } from '@/shared/ui/RecoveryNotice';

import { t } from '@/infrastructure/i18n/utils';
import { mailtoHref } from '@/shared/lib/support/support-mail';
import { buildSupportReport, supportDesignUrl } from '@/shared/lib/support/support-report';

import type { Locale } from '../../../infrastructure/i18n/config';

export type RecoveryReportOptions = {
  /** The localized message the visitor saw. */
  message: string;
  /** Defaults to the design open in the editor, read when the report is built. */
  designUrl?: () => string | undefined;
  onOpen?: (channel: 'email' | 'copy') => void;
};

const subjectFor = (failure: RecoveryFailure): string => `Open Keychain error: ${failure.code}`;

/** Localized email/copy actions for a recovery notice. */
export const recoveryReport = (
  locale: Locale,
  failure: RecoveryFailure,
  options: RecoveryReportOptions,
): RecoveryNoticeReport => ({
  href: mailtoHref(subjectFor(failure), ''),
  build: () => {
    const report = buildSupportReport({
      code: failure.code,
      message: options.message,
      diagnostic: failure.message,
      designUrl: options.designUrl ? options.designUrl() : supportDesignUrl(),
      designNote: t(locale, 'support.designNote'),
      intro: [t(locale, 'support.reportGreeting'), t(locale, 'support.reportPrompt'), ''],
      locale,
      subject: subjectFor(failure),
    });
    return { href: report.mailtoHref, text: report.text };
  },
  emailLabel: t(locale, 'support.emailSupport'),
  copyLabel: t(locale, 'support.copyReport'),
  copiedLabel: t(locale, 'support.copied'),
  copyFailedLabel: t(locale, 'support.copyFailed'),
  onOpen: options.onOpen,
});
