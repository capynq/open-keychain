import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  anonymousCaptureRequest,
  feedbackSubmissionAvailable,
  hasSurveyAnswer,
  recordSurveyDismissed,
  recordSurveyShown,
  registerSurveyTransport,
  submitSurveyResponse,
  surveySentProperties,
  type FeedbackSubmission,
} from './feedback';

const survey = {
  id: 'survey-1',
  name: 'App feedback',
  questions: [
    { id: 'rating', question: 'How was it?' },
    { id: 'text', question: 'Anything else?' },
  ],
} as const;

const submission = (responses: FeedbackSubmission['responses']): FeedbackSubmission => ({
  survey,
  responses,
  context: { trigger: 'export', locale: 'en', template: 'name-keychain', format: '3mf' },
});

const transport = {
  host: 'https://posthog.test/',
  apiKey: 'phc_test',
  context: () => ({ environment: 'production', internal_traffic: false }),
};

describe('survey response properties', () => {
  it('follows the PostHog survey sent contract and keeps only answered questions', () => {
    expect(surveySentProperties(submission({ rating: 4, text: '  ' }), 'submission-1')).toEqual({
      $survey_id: 'survey-1',
      $survey_name: 'App feedback',
      $survey_submission_id: 'submission-1',
      $survey_completed: true,
      $survey_questions: [
        { id: 'rating', question: 'How was it?' },
        { id: 'text', question: 'Anything else?' },
      ],
      $survey_response_rating: 4,
      feedback_trigger: 'export',
      locale: 'en',
      template: 'name-keychain',
      format: '3mf',
    });
  });

  it('trims and caps free text and drops unsafe template ids', () => {
    const properties = surveySentProperties(
      {
        ...submission({ text: ` ${'a'.repeat(1200)} ` }),
        context: { trigger: 'footer', locale: 'ru', template: '<script>' },
      },
      'submission-2',
    );

    expect(properties.$survey_response_text).toHaveLength(1000);
    expect(properties).not.toHaveProperty('template');
    expect(properties).not.toHaveProperty('$survey_response_rating');
  });

  it('needs at least one answer', () => {
    expect(hasSurveyAnswer(submission({ rating: undefined, text: '   ' }))).toBe(false);
    expect(hasSurveyAnswer(submission({ text: 'Great' }))).toBe(true);
  });

  it('builds one anonymous capture without a person profile', () => {
    const request = anonymousCaptureRequest(
      transport,
      { $survey_id: 'survey-1' },
      'random-id',
      'now',
    );

    expect(request.url).toBe('https://posthog.test/i/v0/e/');
    expect(JSON.parse(request.body)).toEqual({
      api_key: 'phc_test',
      event: 'survey sent',
      distinct_id: 'random-id',
      timestamp: 'now',
      properties: {
        $survey_id: 'survey-1',
        $process_person_profile: false,
        $lib: 'open-keychain-feedback',
      },
    });
  });
});

describe('survey transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    registerSurveyTransport(() => false, undefined);
  });

  it('is unavailable without a project key and never sends', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    registerSurveyTransport(() => false, undefined);

    expect(feedbackSubmissionAvailable()).toBe(false);
    await expect(submitSurveyResponse(submission({ rating: 5 }))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the consented SDK when it accepts the event', async () => {
    const fetchMock = vi.fn();
    const capture = vi.fn(() => true);
    vi.stubGlobal('fetch', fetchMock);
    registerSurveyTransport(capture, transport);

    await expect(submitSurveyResponse(submission({ rating: 5 }))).resolves.toBe(true);
    expect(capture).toHaveBeenCalledWith(
      'survey sent',
      expect.objectContaining({ $survey_id: 'survey-1', $survey_response_rating: 5 }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to one anonymous request without consent', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    registerSurveyTransport(() => false, transport);

    await expect(submitSurveyResponse(submission({ text: 'Nice' }))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(url).toBe('https://posthog.test/i/v0/e/');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', keepalive: true });
    expect(body.properties).toMatchObject({
      $survey_response_text: 'Nice',
      $process_person_profile: false,
      environment: 'production',
      internal_traffic: false,
    });
    expect(body.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports a failed delivery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    registerSurveyTransport(() => false, transport);

    await expect(submitSurveyResponse(submission({ rating: 2 }))).resolves.toBe(false);
  });

  it('records shown and dismissed only through the consented SDK', () => {
    const fetchMock = vi.fn();
    const capture = vi.fn(() => false);
    vi.stubGlobal('fetch', fetchMock);
    registerSurveyTransport(capture, transport);

    recordSurveyShown(survey, { trigger: 'print_check', locale: 'uk' });
    recordSurveyDismissed(survey, { trigger: 'print_check', locale: 'uk' });

    expect(capture).toHaveBeenNthCalledWith(1, 'survey shown', {
      $survey_id: 'survey-1',
      $survey_name: 'App feedback',
      feedback_trigger: 'print_check',
      locale: 'uk',
    });
    expect(capture).toHaveBeenNthCalledWith(2, 'survey dismissed', expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
