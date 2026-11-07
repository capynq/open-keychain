import { Camera } from 'lucide-react';

import { t } from '@/infrastructure/i18n/utils';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { Locale } from '../../../../infrastructure/i18n/config';
import type { LastExport } from '../../model/feedback-storage';

import { printResultMailHref } from '../../model/print-result-mail';
import { FeedbackForm, type FeedbackAnswers } from '../FeedbackForm/FeedbackForm';
import styles from './ExportFeedback.module.css';

/** Post-export ask inside the export dialog: a quick rating, then a request for a print photo. */
export const ExportFeedback = ({
  locale,
  lastExport,
  onSubmit,
}: {
  locale: Locale;
  lastExport: LastExport;
  onSubmit: (answers: FeedbackAnswers) => Promise<boolean>;
}) => {
  const { track } = useAnalytics();

  return (
    <section className={styles.root} data-testid="export-feedback">
      <FeedbackForm
        locale={locale}
        heading={t(locale, 'feedback.exportHeading')}
        onSubmit={onSubmit}
      />
      <p className={styles.photo}>
        <Camera aria-hidden="true" size={16} />
        <span>
          {t(locale, 'feedback.photoPrompt')}{' '}
          <a
            href={printResultMailHref(locale, lastExport)}
            onClick={() => track('support_contact_opened', { reason: 'print_result' })}
          >
            {t(locale, 'feedback.photoLink')}
          </a>
        </span>
      </p>
    </section>
  );
};
