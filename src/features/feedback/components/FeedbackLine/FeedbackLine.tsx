import { Mail } from 'lucide-react';

import { t } from '@/infrastructure/i18n/utils';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';
import { mailtoHref, SUPPORT_EMAIL } from '@/shared/lib/support/support-mail';

import type { Locale } from '../../../../infrastructure/i18n/config';

import { FeedbackButton } from '../FeedbackDialog/FeedbackDialog';
import styles from './FeedbackLine.module.css';

/** Always-available feedback entry: the in-app form plus a direct support address. */
export const FeedbackLine = ({
  locale,
  className,
  showLead = true,
}: {
  locale: Locale;
  className?: string;
  showLead?: boolean;
}) => {
  const { track } = useAnalytics();

  return (
    <p className={[styles.root, className].filter(Boolean).join(' ')} data-feedback-line>
      {showLead && <span className={styles.lead}>{t(locale, 'feedback.lineLead')}</span>}
      <FeedbackButton locale={locale} className={styles.action} />
      <a
        className={styles.action}
        href={mailtoHref('Open Keychain', '')}
        onClick={() => track('support_contact_opened', { reason: 'feedback' })}
      >
        <Mail aria-hidden="true" size={16} />
        <span>{SUPPORT_EMAIL}</span>
      </a>
    </p>
  );
};
