import { t } from '@/infrastructure/i18n/utils';
import { fitMailBody, mailtoHref } from '@/shared/lib/support/support-mail';
import { appBuildLabel } from '@/shared/lib/support/support-report';

import type { Locale } from '../../../infrastructure/i18n/config';
import type { LastExport } from './feedback-storage';

import { PRINT_OUTCOMES, type PrintOutcomeId } from './surveys';

/**
 * Prefilled email asking for a photo of the print, good or bad. The design link lets support
 * reopen the exact design; the visitor sees it before sending and can delete it.
 */
export const printResultMailHref = (
  locale: Locale,
  lastExport: LastExport | undefined,
  outcome?: PrintOutcomeId,
): string => {
  const outcomeText = PRINT_OUTCOMES.find((item) => item.id === outcome)?.choice;
  const template = lastExport?.template ?? 'unknown';
  const subject = outcomeText
    ? `Print result: ${outcomeText} · ${template}`
    : `Print result · ${template}`;
  const body = fitMailBody([
    {
      lines: [
        t(locale, 'support.reportGreeting'),
        t(locale, 'feedback.mail.photoPrompt'),
        '',
        `${t(locale, 'feedback.mail.printerLine')} `,
        `${t(locale, 'feedback.mail.whatHappenedLine')} `,
      ],
    },
    {
      lines: [
        '--- Print details ---',
        ...(outcomeText ? [`Result: ${outcomeText}`] : []),
        `Template: ${template}`,
        ...(lastExport?.format ? [`File: ${lastExport.format.toUpperCase()}`] : []),
        ...(lastExport ? [`Exported: ${new Date(lastExport.at).toISOString().slice(0, 10)}`] : []),
        `App: ${appBuildLabel()}`,
        `Language: ${locale}`,
      ],
    },
    {
      dropOrder: 1,
      lines: lastExport?.designUrl
        ? [t(locale, 'support.designNote'), `Design: ${lastExport.designUrl}`]
        : [],
    },
  ]);

  return mailtoHref(subject, body);
};
