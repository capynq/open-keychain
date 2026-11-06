import { expect, test, type Page, type Request } from '@playwright/test';

import { waitForReadyGeometry, watchBrowserErrors } from './helpers';

const APP_FEEDBACK_SURVEY = '01a1b2d5-8181-0000-7c08-a2fd5211ce56';
const PRINT_OUTCOME_SURVEY = '01a1b2d5-8db2-0000-e575-d7bb47b250bb';

type CaptureBody = {
  api_key: string;
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
};

/** Test builds point PostHog at https://posthog.test; record every request sent there. */
const captureFeedbackRequests = async (page: Page): Promise<Request[]> => {
  const requests: Request[] = [];
  await page.route('https://posthog.test/**', async (route) => {
    requests.push(route.request());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  return requests;
};

const bodyOf = (request: Request): CaptureBody => request.postDataJSON() as CaptureBody;

const declineAnalytics = (page: Page, feedbackState?: Record<string, unknown>) =>
  page.addInitScript((state) => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
    /* Seed once: init scripts run again on reload and must not undo what the page stored. */
    if (state && !localStorage.getItem('open-keychain.feedback'))
      localStorage.setItem('open-keychain.feedback', JSON.stringify(state));
  }, feedbackState);

test('asks once after a successful export and sends one anonymous answer on Send', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  const requests = await captureFeedbackRequests(page);
  await declineAnalytics(page);
  await page.goto('/create');
  await waitForReadyGeometry(page);

  await page.locator('.export-header-button').click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  await expect(dialog.getByTestId('export-feedback')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  await download;
  await expect(dialog).toContainText('Download ready');

  const prompt = dialog.getByTestId('export-feedback');
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('button', { name: 'Send' })).toHaveCount(0);
  await expect(prompt.getByRole('link', { name: 'Email a photo' })).toHaveAttribute(
    'href',
    /^mailto:support@open-keychain\.com\?subject=Print%20result.*Design%3A%20http/,
  );
  expect(requests).toHaveLength(0);

  await prompt.getByRole('radio', { name: '4 out of 5' }).check();
  await prompt.getByLabel('Anything to add? (optional)').fill('Easy, but I wanted more fonts');
  await prompt.getByRole('button', { name: 'Send' }).click();
  await expect(prompt.getByRole('status')).toHaveText(
    'Thank you! Every answer helps us improve Open Keychain.',
  );

  expect(requests).toHaveLength(1);
  expect(requests[0].url()).toBe('https://posthog.test/i/v0/e/');
  const body = bodyOf(requests[0]);
  expect(body).toMatchObject({ api_key: 'phc_playwright', event: 'survey sent' });
  expect(body.properties).toMatchObject({
    $survey_id: APP_FEEDBACK_SURVEY,
    $survey_completed: true,
    feedback_trigger: 'export',
    format: 'stl',
    locale: 'en',
    $process_person_profile: false,
  });
  expect(body.properties['$survey_response_40d3c4ef-72fe-4451-9e6f-e0b7540709a9']).toBe(4);
  expect(body.properties['$survey_response_c3a5d685-6232-48c5-adc9-1ac250de0992']).toBe(
    'Easy, but I wanted more fonts',
  );
  expect(JSON.stringify(body)).not.toContain('ALEX');

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('open-keychain.feedback') ?? '{}'),
  );
  expect(stored).toMatchObject({ lastExport: { format: 'stl', template: 'name-keychain' } });
  expect(stored.lastExport.designUrl).toMatch(/[?&]design=/);
  expect(stored.answeredAt).toEqual(expect.any(Number));

  await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.locator('.export-header-button').click();
  const again = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  await again;
  await expect(dialog).toContainText('Download ready');
  await expect(dialog.getByTestId('export-feedback')).toHaveCount(0);
  expect(requests).toHaveLength(1);
  assertNoBrowserErrors();
});

test('asks how the last print went on a return visit and offers a photo email', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  const requests = await captureFeedbackRequests(page);
  const exportedAt = Date.now() - 5 * 60 * 60 * 1000;
  await declineAnalytics(page, {
    v: 1,
    lastExport: {
      at: exportedAt,
      format: '3mf',
      template: 'articulated-name',
      designUrl: 'https://open-keychain.com/create?design=test-design',
    },
  });
  await page.goto('/create');
  await waitForReadyGeometry(page);

  const notice = page.getByTestId('print-check');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Did your last print come out right?');
  await expect(notice).toContainText('3MF');
  await notice.getByRole('radio', { name: "Didn't work" }).check();
  const photo = notice.getByRole('link', { name: 'Help us fix it: email a photo' });
  await expect(photo).toHaveAttribute(
    'href',
    /subject=Print%20result%3A%20Didn't%20work%20%C2%B7%20articulated-name.*Design%3A%20https%3A%2F%2Fopen-keychain\.com%2Fcreate%3Fdesign%3Dtest-design/,
  );
  await notice.getByLabel('What happened? (optional)').fill('The letters came apart');
  await notice.getByRole('button', { name: 'Send' }).click();
  await expect(notice.getByRole('status')).toHaveText(/Thank you!/);
  await expect(photo).toBeVisible();

  expect(requests).toHaveLength(1);
  const body = bodyOf(requests[0]);
  expect(body.properties).toMatchObject({
    $survey_id: PRINT_OUTCOME_SURVEY,
    feedback_trigger: 'print_check',
    template: 'articulated-name',
    format: '3mf',
    '$survey_response_835843d3-ddb9-44ec-b6ee-67a6f7ae8711': "Didn't work",
    '$survey_response_867357e6-1961-4c0e-98d7-7b1fc9217c62': 'The letters came apart',
  });

  await notice.getByRole('button', { name: 'Not now' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await waitForReadyGeometry(page);
  await expect(page.getByTestId('print-check')).toHaveCount(0);
  assertNoBrowserErrors();
});

test('keeps a feedback form and the support address one click away', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  const requests = await captureFeedbackRequests(page);
  await declineAnalytics(page);
  await page.goto('/');

  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'support@open-keychain.com' })).toHaveAttribute(
    'href',
    /^mailto:support@open-keychain\.com/,
  );
  await footer.getByTestId('feedback-open').click();
  const dialog = page.getByTestId('feedback-dialog');
  await expect(dialog).toBeVisible();
  const text = dialog.getByLabel('Anything to add? (optional)');
  await expect(text).toBeFocused();
  await text.fill('Please add a heart shape');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByRole('status')).toHaveText(/Thank you!/);
  expect(requests).toHaveLength(1);
  expect(bodyOf(requests[0]).properties).toMatchObject({
    $survey_id: APP_FEEDBACK_SURVEY,
    feedback_trigger: 'footer',
    '$survey_response_c3a5d685-6232-48c5-adc9-1ac250de0992': 'Please add a heart shape',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(footer.getByTestId('feedback-open')).toBeFocused();
  assertNoBrowserErrors();
});

test('carries a name typed on the landing page into quick setup without putting it in the URL', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await declineAnalytics(page);
  await page.goto('/');

  const hero = page.locator('.landing-hero');
  await hero.getByLabel('Name or text').fill('MAYA');
  await hero.getByRole('button', { name: 'Start designing' }).click();
  await expect(page).toHaveURL('/create?setup=1&lang=en');
  const setup = page.getByTestId('quick-setup-dialog');
  await expect(setup.getByLabel('Name or text')).toHaveValue('MAYA');
  assertNoBrowserErrors();
});
