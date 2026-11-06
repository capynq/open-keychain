/**
 * Explicit feedback transport for app-rendered PostHog `api` surveys.
 *
 * Consenting visitors send through the loaded SDK, so answers join their pseudonymous profile.
 * Everyone else sends only when they press Send: one anonymous capture request with a random ID
 * and no person profile. Shown/dismissed events are recorded only with consent.
 */

export type SurveyQuestionRef = { readonly id: string; readonly question: string };

export type SurveyDefinition = {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly SurveyQuestionRef[];
};

export type FeedbackTrigger = 'export' | 'print_check' | 'footer';

export type FeedbackContext = {
  trigger: FeedbackTrigger;
  locale: 'en' | 'ru' | 'uk';
  template?: string;
  format?: 'stl' | '3mf';
};

export type FeedbackSubmission = {
  survey: SurveyDefinition;
  responses: Readonly<Record<string, string | number | undefined>>;
  context: FeedbackContext;
};

type SurveyEventName = 'survey shown' | 'survey sent' | 'survey dismissed';
type SurveyProperties = Record<string, unknown>;

/** Returns true when the consented SDK captured the event. */
type ConsentedSurveyCapture = (event: SurveyEventName, properties: SurveyProperties) => boolean;

type AnonymousTransport = {
  host: string;
  apiKey: string;
  context: () => Record<string, string | boolean>;
};

export const FEEDBACK_TEXT_LIMIT = 1000;
const SAFE_TEMPLATE = /^[a-z0-9-]{1,64}$/;

let consentedCapture: ConsentedSurveyCapture | undefined;
let anonymousTransport: AnonymousTransport | undefined;

export const registerSurveyTransport = (
  capture: ConsentedSurveyCapture,
  transport: AnonymousTransport | undefined,
): void => {
  consentedCapture = capture;
  anonymousTransport = transport;
};

/** False in builds without a PostHog project key; callers fall back to email. */
export const feedbackSubmissionAvailable = (): boolean => Boolean(anonymousTransport);

const contextProperties = (context: FeedbackContext): SurveyProperties => ({
  feedback_trigger: context.trigger,
  locale: context.locale,
  ...(context.template && SAFE_TEMPLATE.test(context.template)
    ? { template: context.template }
    : {}),
  ...(context.format ? { format: context.format } : {}),
});

const surveyIdentity = (survey: SurveyDefinition): SurveyProperties => ({
  $survey_id: survey.id,
  $survey_name: survey.name,
});

const cleanResponse = (value: string | number | undefined): string | number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const text = value?.trim().slice(0, FEEDBACK_TEXT_LIMIT);
  return text ? text : undefined;
};

/** The `survey sent` properties PostHog's survey results read. */
export const surveySentProperties = (
  submission: FeedbackSubmission,
  submissionId: string,
): SurveyProperties => {
  const answers = submission.survey.questions.flatMap(({ id }) => {
    const value = cleanResponse(submission.responses[id]);
    return value === undefined ? [] : [[`$survey_response_${id}`, value] as const];
  });

  return {
    ...surveyIdentity(submission.survey),
    $survey_submission_id: submissionId,
    $survey_completed: true,
    $survey_questions: submission.survey.questions.map(({ id, question }) => ({ id, question })),
    ...Object.fromEntries(answers),
    ...contextProperties(submission.context),
  };
};

export const hasSurveyAnswer = (submission: FeedbackSubmission): boolean =>
  submission.survey.questions.some(
    ({ id }) => cleanResponse(submission.responses[id]) !== undefined,
  );

/** One anonymous capture request: random distinct ID, no person profile, no stored identity. */
export const anonymousCaptureRequest = (
  transport: Pick<AnonymousTransport, 'host' | 'apiKey'>,
  properties: SurveyProperties,
  distinctId: string,
  timestamp: string,
): { url: string; body: string } => ({
  url: `${transport.host.replace(/\/+$/, '')}/i/v0/e/`,
  body: JSON.stringify({
    api_key: transport.apiKey,
    event: 'survey sent',
    distinct_id: distinctId,
    timestamp,
    properties: {
      ...properties,
      $process_person_profile: false,
      $lib: 'open-keychain-feedback',
    },
  }),
});

export const recordSurveyShown = (survey: SurveyDefinition, context: FeedbackContext): void => {
  try {
    consentedCapture?.('survey shown', {
      ...surveyIdentity(survey),
      ...contextProperties(context),
    });
  } catch {
    /* analytics must never break the prompt */
  }
};

export const recordSurveyDismissed = (survey: SurveyDefinition, context: FeedbackContext): void => {
  try {
    consentedCapture?.('survey dismissed', {
      ...surveyIdentity(survey),
      ...contextProperties(context),
    });
  } catch {
    /* analytics must never break the prompt */
  }
};

/** Sends one completed response. Resolves false when nothing could be delivered. */
export const submitSurveyResponse = async (submission: FeedbackSubmission): Promise<boolean> => {
  if (!anonymousTransport || !hasSurveyAnswer(submission)) return false;
  const properties = surveySentProperties(submission, crypto.randomUUID());

  try {
    if (consentedCapture?.('survey sent', properties)) return true;
  } catch {
    /* fall through to the anonymous request */
  }

  const request = anonymousCaptureRequest(
    anonymousTransport,
    { ...properties, ...anonymousTransport.context() },
    crypto.randomUUID(),
    new Date().toISOString(),
  );
  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: request.body,
      credentials: 'omit',
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
};
