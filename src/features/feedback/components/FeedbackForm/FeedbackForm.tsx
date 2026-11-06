import { useId, useState, type ReactNode } from 'react';

import { t } from '@/infrastructure/i18n/utils';
import { feedbackSubmissionAvailable } from '@/infrastructure/telemetry/feedback';
import { mailtoHref, SUPPORT_EMAIL } from '@/shared/lib/support/support-mail';

import type { Locale } from '../../../../infrastructure/i18n/config';

import styles from './FeedbackForm.module.css';

export type FeedbackAnswers = { rating?: number; text: string };

type Status = 'idle' | 'sending' | 'sent' | 'failed';

const RATINGS = [1, 2, 3, 4, 5] as const;
const TEXT_LIMIT = 1000;

const emailBody = (locale: Locale, answers: FeedbackAnswers): string =>
  [
    answers.text.trim(),
    '',
    ...(answers.rating ? [`${t(locale, 'feedback.mailRating')}: ${answers.rating}/5`] : []),
  ].join('\n');

/**
 * Optional 1–5 rating plus optional text. Sends only on submit; when the build has no PostHog
 * key, or sending fails, the answers go into a prefilled email instead.
 */
export const FeedbackForm = ({
  locale,
  heading,
  textFirst = false,
  onSubmit,
  sentExtra,
}: {
  locale: Locale;
  heading: string;
  /** Show the text box before a rating is chosen (general feedback). */
  textFirst?: boolean;
  onSubmit: (answers: FeedbackAnswers) => Promise<boolean>;
  /** Shown under the thanks message, e.g. the print photo request. */
  sentExtra?: ReactNode;
}) => {
  const headingId = useId();
  const textId = useId();
  const [rating, setRating] = useState<number>();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const transportAvailable = feedbackSubmissionAvailable();
  const answers: FeedbackAnswers = { rating, text };
  const canSend = Boolean(rating || text.trim()) && status !== 'sending';
  /* A rating reveals the text box, privacy note and Send, keeping the first ask one row tall. */
  const expanded = textFirst || rating !== undefined || text !== '';
  const emailHref = mailtoHref(t(locale, 'feedback.mailSubject'), emailBody(locale, answers));

  if (status === 'sent') {
    return (
      <div className={styles.root} data-feedback-state="sent">
        <p className={styles.thanks} role="status">
          {t(locale, 'feedback.thanks')}
        </p>
        {sentExtra}
      </div>
    );
  }

  const placeholder = textFirst
    ? t(locale, 'feedback.textPlaceholder')
    : rating !== undefined && rating <= 3
      ? t(locale, 'feedback.textPlaceholderLow')
      : t(locale, 'feedback.textPlaceholderHigh');

  return (
    <form
      className={styles.root}
      aria-labelledby={headingId}
      data-feedback-state={status}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        if (!transportAvailable) {
          window.location.href = emailHref;
          setStatus('sent');
          return;
        }
        setStatus('sending');
        void onSubmit(answers).then((sent) => setStatus(sent ? 'sent' : 'failed'));
      }}
    >
      <p id={headingId} className={styles.heading}>
        {heading}
      </p>
      <fieldset className={styles.rating}>
        <legend className="sr-only">{t(locale, 'feedback.ratingLegend')}</legend>
        <div className={styles.scale}>
          {RATINGS.map((value) => (
            <label key={value} className={styles.ratingOption}>
              <input
                type="radio"
                name={`${headingId}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                aria-label={t(locale, 'feedback.ratingOption', { value })}
              />
              <span aria-hidden="true">{value}</span>
            </label>
          ))}
        </div>
        <div className={styles.scaleLabels} aria-hidden="true">
          <span>{t(locale, 'feedback.ratingLow')}</span>
          <span>{t(locale, 'feedback.ratingHigh')}</span>
        </div>
      </fieldset>
      {expanded && (
        <div className={styles.field}>
          <label htmlFor={textId}>{t(locale, 'feedback.textLabel')}</label>
          <textarea
            id={textId}
            rows={3}
            maxLength={TEXT_LIMIT}
            value={text}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      )}
      {expanded && (
        <>
          <p className={styles.hint}>
            {t(locale, 'feedback.privacyHint')}{' '}
            <span>
              {t(locale, 'feedback.replyHint')}{' '}
              <a href={mailtoHref('Open Keychain', '')}>{SUPPORT_EMAIL}</a>
            </span>
          </p>
          {status === 'failed' && (
            <p className={styles.error} role="alert">
              {t(locale, 'feedback.failed')}{' '}
              <a href={emailHref}>{t(locale, 'feedback.emailInstead')}</a>
            </p>
          )}
          <div className={styles.actions}>
            <button className={styles.send} type="submit" disabled={!canSend}>
              {status === 'sending'
                ? t(locale, 'feedback.sending')
                : transportAvailable
                  ? t(locale, 'feedback.send')
                  : t(locale, 'feedback.sendByEmail')}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
