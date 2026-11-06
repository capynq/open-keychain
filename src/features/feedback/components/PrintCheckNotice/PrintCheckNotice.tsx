import { Camera, X } from 'lucide-react';
import { useId, useState } from 'react';

import { t, templateName } from '@/infrastructure/i18n/utils';
import { feedbackSubmissionAvailable } from '@/infrastructure/telemetry/feedback';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';
import { IconButton } from '@/shared/ui/IconButton';

import type { Locale } from '../../../../infrastructure/i18n/config';
import type { LastExport } from '../../model/feedback-storage';

import { printResultMailHref } from '../../model/print-result-mail';
import { PRINT_OUTCOMES, type PrintOutcomeId } from '../../model/surveys';
import styles from './PrintCheckNotice.module.css';

type Status = 'idle' | 'sending' | 'sent' | 'failed';

const OUTCOME_LABEL_KEYS: Record<PrintOutcomeId, string> = {
  fine: 'feedback.printCheck.fine',
  tweaks: 'feedback.printCheck.tweaks',
  failed: 'feedback.printCheck.failed',
  'not-yet': 'feedback.printCheck.notYet',
};

/** Return-visit question about the last exported file, with a photo request for real prints. */
export const PrintCheckNotice = ({
  locale,
  lastExport,
  onSubmit,
  onDismiss,
}: {
  locale: Locale;
  lastExport: LastExport;
  onSubmit: (outcome: PrintOutcomeId, text: string) => Promise<boolean>;
  onDismiss: (answered: boolean) => void;
}) => {
  const titleId = useId();
  const textId = useId();
  const { track } = useAnalytics();
  const [outcome, setOutcome] = useState<PrintOutcomeId>();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const exportedOn = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    lastExport.at,
  );
  const meta = [
    lastExport.template
      ? templateName(locale, lastExport.template, lastExport.template)
      : undefined,
    lastExport.format?.toUpperCase(),
    exportedOn,
  ]
    .filter(Boolean)
    .join(' · ');
  const printed = outcome !== undefined && outcome !== 'not-yet';
  const sendable = feedbackSubmissionAvailable();

  return (
    <aside className={styles.root} aria-labelledby={titleId} data-testid="print-check">
      <div className={styles.header}>
        <div className={styles.titles}>
          <p id={titleId} className={styles.title}>
            {t(locale, 'feedback.printCheck.title')}
          </p>
          <p className={styles.meta}>{meta}</p>
        </div>
        <IconButton
          action="dismiss-print-check"
          icon={X}
          label={t(locale, 'feedback.printCheck.dismiss')}
          motion="scale"
          onClick={() => onDismiss(status === 'sent')}
        />
      </div>
      {status === 'sent' ? (
        <p className={styles.thanks} role="status">
          {t(locale, 'feedback.thanks')}
        </p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!outcome || status === 'sending') return;
            setStatus('sending');
            void onSubmit(outcome, text).then((sent) => setStatus(sent ? 'sent' : 'failed'));
          }}
        >
          <fieldset className={styles.outcomes}>
            <legend className="sr-only">{t(locale, 'feedback.printCheck.title')}</legend>
            {PRINT_OUTCOMES.map((item) => (
              <label key={item.id} className={styles.outcome}>
                <input
                  type="radio"
                  name={`${titleId}-outcome`}
                  value={item.id}
                  checked={outcome === item.id}
                  onChange={() => setOutcome(item.id)}
                />
                <span>{t(locale, OUTCOME_LABEL_KEYS[item.id])}</span>
              </label>
            ))}
          </fieldset>
          {outcome && sendable && (
            <>
              <div className={styles.field}>
                <label htmlFor={textId}>{t(locale, 'feedback.printCheck.textLabel')}</label>
                <textarea
                  id={textId}
                  rows={2}
                  maxLength={1000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </div>
              {status === 'failed' && (
                <p className={styles.error} role="alert">
                  {t(locale, 'feedback.failed')}
                </p>
              )}
              <div className={styles.actions}>
                <button className={styles.send} type="submit" disabled={status === 'sending'}>
                  {status === 'sending'
                    ? t(locale, 'feedback.sending')
                    : t(locale, 'feedback.send')}
                </button>
              </div>
            </>
          )}
        </form>
      )}
      {printed && (
        <a
          className={styles.photo}
          href={printResultMailHref(locale, lastExport, outcome)}
          onClick={() => track('support_contact_opened', { reason: 'print_result' })}
        >
          <Camera aria-hidden="true" size={18} />
          <span>
            {outcome === 'fine'
              ? t(locale, 'feedback.printCheck.photoFine')
              : t(locale, 'feedback.printCheck.photoProblem')}
          </span>
        </a>
      )}
    </aside>
  );
};
