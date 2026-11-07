import { useEffect, useRef, useState } from 'react';

import {
  feedbackSubmissionAvailable,
  recordSurveyDismissed,
  recordSurveyShown,
  submitSurveyResponse,
  type FeedbackContext,
} from '@/infrastructure/telemetry/feedback';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { Locale } from '../../../infrastructure/i18n/config';

import {
  readFeedbackState,
  shouldShowPrintCheck,
  updateFeedbackState,
  type LastExport,
} from '../model/feedback-storage';
import {
  PRINT_OUTCOME_CHOICE_ID,
  PRINT_OUTCOME_SURVEY,
  PRINT_OUTCOME_TEXT_ID,
  PRINT_OUTCOMES,
  type PrintOutcomeId,
} from '../model/surveys';

const pendingPrintCheck = (): LastExport | undefined => {
  const state = readFeedbackState();
  return shouldShowPrintCheck(state, Date.now()) ? state.lastExport : undefined;
};

/**
 * On a return visit 3 h–30 days after an export, ask once how that print came out. Waits until
 * the consent banner is answered so the two never stack, and only asks when the answer can be sent.
 */
export const usePrintCheck = (
  locale: Locale,
  /** False while a dialog covers the card; the impression waits until it is really on screen. */
  onScreen = true,
) => {
  const { consent } = useAnalytics();
  const [lastExport, setLastExport] = useState(pendingPrintCheck);
  const impressionRecorded = useRef(false);
  /* Builds without a PostHog key have nowhere to send the answer, so they never ask. */
  const visible = Boolean(lastExport) && consent !== 'unknown' && feedbackSubmissionAvailable();
  const context: FeedbackContext = {
    trigger: 'print_check',
    locale,
    template: lastExport?.template,
    format: lastExport?.format,
  };
  const shownTemplate = visible ? lastExport?.template : undefined;
  const shownFormat = visible ? lastExport?.format : undefined;

  useEffect(() => {
    if (!visible || !onScreen || impressionRecorded.current) return;
    impressionRecorded.current = true;
    recordSurveyShown(PRINT_OUTCOME_SURVEY, {
      trigger: 'print_check',
      locale,
      template: shownTemplate,
      format: shownFormat,
    });
  }, [visible, onScreen, locale, shownTemplate, shownFormat]);

  const markDone = (): void => {
    if (lastExport) updateFeedbackState({ printCheckDoneFor: lastExport.at });
  };

  const submit = async (outcome: PrintOutcomeId, text: string): Promise<boolean> => {
    const choice = PRINT_OUTCOMES.find((item) => item.id === outcome)?.choice;
    const sent = await submitSurveyResponse({
      survey: PRINT_OUTCOME_SURVEY,
      responses: { [PRINT_OUTCOME_CHOICE_ID]: choice, [PRINT_OUTCOME_TEXT_ID]: text },
      context,
    });
    if (sent) markDone();
    return sent;
  };

  /** Close without answering; with `answered` the response was already sent. */
  const dismiss = (answered: boolean): void => {
    if (!answered) recordSurveyDismissed(PRINT_OUTCOME_SURVEY, context);
    markDone();
    setLastExport(undefined);
  };

  return { lastExport: visible ? lastExport : undefined, submit, dismiss };
};
