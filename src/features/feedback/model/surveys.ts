import type { SurveyDefinition } from '@/infrastructure/telemetry/feedback';

/*
 * PostHog `api` surveys in project 251074. The app renders them; IDs must match PostHog so
 * responses land in survey results. Question text is the English base text PostHog shows.
 */

export const APP_FEEDBACK_SURVEY = {
  id: '01a1b2d5-8181-0000-7c08-a2fd5211ce56',
  name: 'App feedback',
  questions: [
    { id: '40d3c4ef-72fe-4451-9e6f-e0b7540709a9', question: 'How was making your design?' },
    { id: 'c3a5d685-6232-48c5-adc9-1ac250de0992', question: 'What would make it better?' },
  ],
} as const satisfies SurveyDefinition;

export const APP_FEEDBACK_RATING_ID = APP_FEEDBACK_SURVEY.questions[0].id;
export const APP_FEEDBACK_TEXT_ID = APP_FEEDBACK_SURVEY.questions[1].id;

export const PRINT_OUTCOME_SURVEY = {
  id: '01a1b2d5-8db2-0000-e575-d7bb47b250bb',
  name: 'Print outcome',
  questions: [
    { id: '835843d3-ddb9-44ec-b6ee-67a6f7ae8711', question: 'Did your last print come out right?' },
    { id: '867357e6-1961-4c0e-98d7-7b1fc9217c62', question: 'What happened?' },
  ],
} as const satisfies SurveyDefinition;

export const PRINT_OUTCOME_CHOICE_ID = PRINT_OUTCOME_SURVEY.questions[0].id;
export const PRINT_OUTCOME_TEXT_ID = PRINT_OUTCOME_SURVEY.questions[1].id;

/** Stable outcome IDs; `choice` is the exact PostHog choice text the response must carry. */
export const PRINT_OUTCOMES = [
  { id: 'fine', choice: 'Printed fine' },
  { id: 'tweaks', choice: 'Needed tweaks' },
  { id: 'failed', choice: "Didn't work" },
  { id: 'not-yet', choice: "Haven't printed yet" },
] as const;

export type PrintOutcomeId = (typeof PRINT_OUTCOMES)[number]['id'];
