import { MessageSquare, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { t } from '@/infrastructure/i18n/utils';
import {
  recordSurveyDismissed,
  recordSurveyShown,
  submitSurveyResponse,
  type FeedbackContext,
} from '@/infrastructure/telemetry/feedback';
import { IconButton } from '@/shared/ui/IconButton';

import type { Locale } from '../../../../infrastructure/i18n/config';

import { updateFeedbackState } from '../../model/feedback-storage';
import {
  APP_FEEDBACK_RATING_ID,
  APP_FEEDBACK_SURVEY,
  APP_FEEDBACK_TEXT_ID,
} from '../../model/surveys';
import { FeedbackForm, type FeedbackAnswers } from '../FeedbackForm/FeedbackForm';
import styles from './FeedbackDialog.module.css';

const FeedbackDialog = ({ locale, onClose }: { locale: Locale; onClose: () => void }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const answered = useRef(false);
  const context: FeedbackContext = { trigger: 'footer', locale };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    recordSurveyShown(APP_FEEDBACK_SURVEY, { trigger: 'footer', locale });

    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [locale]);

  const close = (): void => {
    if (!answered.current) recordSurveyDismissed(APP_FEEDBACK_SURVEY, context);
    onClose();
  };

  const submit = async (answers: FeedbackAnswers): Promise<boolean> => {
    const sent = await submitSurveyResponse({
      survey: APP_FEEDBACK_SURVEY,
      responses: { [APP_FEEDBACK_RATING_ID]: answers.rating, [APP_FEEDBACK_TEXT_ID]: answers.text },
      context,
    });
    if (sent) {
      answered.current = true;
      updateFeedbackState({ answeredAt: Date.now() });
    }
    return sent;
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="feedback-dialog-title"
      data-testid="feedback-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close();
      }}
    >
      <div className={styles.heading}>
        <h2 id="feedback-dialog-title">{t(locale, 'feedback.dialogTitle')}</h2>
        <IconButton
          action="close-feedback"
          icon={X}
          label={t(locale, 'close')}
          motion="scale"
          onClick={close}
        />
      </div>
      <p className={styles.intro}>{t(locale, 'feedback.dialogIntro')}</p>
      <FeedbackForm
        locale={locale}
        heading={t(locale, 'feedback.footerHeading')}
        textFirst
        onSubmit={submit}
      />
    </dialog>
  );
};

/** "Send feedback" trigger for footers; the dialog mounts only while open. */
export const FeedbackButton = ({ locale, className }: { locale: Locale; className?: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        data-testid="feedback-open"
      >
        <MessageSquare aria-hidden="true" size={16} />
        <span>{t(locale, 'feedback.openDialog')}</span>
      </button>
      {/* Portal: footers style their links and buttons, which must not leak into the dialog. */}
      {open &&
        createPortal(
          <FeedbackDialog locale={locale} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
};
