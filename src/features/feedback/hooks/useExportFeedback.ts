import { useRef, useState } from 'react';

import {
  recordSurveyDismissed,
  recordSurveyShown,
  submitSurveyResponse,
  type FeedbackContext,
} from '@/infrastructure/telemetry/feedback';

import type { Locale } from '../../../infrastructure/i18n/config';
import type { FeedbackAnswers } from '../components/FeedbackForm/FeedbackForm';

import {
  readFeedbackState,
  shouldShowExportPrompt,
  updateFeedbackState,
  type LastExport,
} from '../model/feedback-storage';
import {
  APP_FEEDBACK_RATING_ID,
  APP_FEEDBACK_SURVEY,
  APP_FEEDBACK_TEXT_ID,
} from '../model/surveys';

export type ExportSuccessDetails = Omit<LastExport, 'at'>;

/**
 * Records each successful export on this device and decides, once per export dialog session,
 * whether to ask for feedback (not within 60 days of an answer or 14 days of the last ask).
 */
export const useExportFeedback = (locale: Locale) => {
  const [prompt, setPrompt] = useState<LastExport>();
  const answered = useRef(false);
  const context = (details: ExportSuccessDetails | undefined): FeedbackContext => ({
    trigger: 'export',
    locale,
    template: details?.template,
    format: details?.format,
  });

  const onExportSuccess = (details: ExportSuccessDetails): void => {
    const now = Date.now();
    const lastExport: LastExport = { at: now, ...details };
    const state = readFeedbackState();
    updateFeedbackState({ lastExport });
    if (prompt) {
      setPrompt(lastExport);
      return;
    }
    if (!shouldShowExportPrompt(state, now)) return;
    updateFeedbackState({ exportPromptedAt: now });
    answered.current = false;
    setPrompt(lastExport);
    recordSurveyShown(APP_FEEDBACK_SURVEY, context(details));
  };

  const submit = async (answers: FeedbackAnswers): Promise<boolean> => {
    const sent = await submitSurveyResponse({
      survey: APP_FEEDBACK_SURVEY,
      responses: { [APP_FEEDBACK_RATING_ID]: answers.rating, [APP_FEEDBACK_TEXT_ID]: answers.text },
      context: context(prompt),
    });
    if (sent) {
      answered.current = true;
      updateFeedbackState({ answeredAt: Date.now() });
    }
    return sent;
  };

  /** Call when the export dialog closes; an unanswered prompt counts as dismissed. */
  const close = (): void => {
    if (prompt && !answered.current) recordSurveyDismissed(APP_FEEDBACK_SURVEY, context(prompt));
    answered.current = false;
    setPrompt(undefined);
  };

  return { prompt, onExportSuccess, submit, close };
};
