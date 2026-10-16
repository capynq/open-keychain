import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
  });
});

test('opens in Simple mode and persists an explicit Pro choice', async ({ page }) => {
  await page.goto('/create');

  const mode = page.getByTestId('editor-mode');
  await expect(mode.locator('input[value="simple"]')).toBeChecked();
  await expect(mode.locator('input[value="pro"]')).not.toBeChecked();
  await expect(page.getByTestId('simple-adjustment-settings')).toBeVisible();
  await expect(page.getByTestId('font-browser')).toHaveCount(0);

  await page.locator('#root').getByTestId('editor-mode').getByText('Pro', { exact: true }).click();
  await expect(page.getByTestId('font-browser')).toBeVisible();
  await expect(page.getByTestId('simple-adjustment-settings')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('editor-mode').locator('input[value="pro"]')).toBeChecked();
  await expect(page.getByTestId('font-browser')).toBeVisible();
});

for (const section of ['Typography', 'Shape', 'Print']) {
  test(`Fine tune opens ${section} in Pro and moves focus there`, async ({ page }) => {
    await page.goto('/create');
    const action = page.getByRole('button', { name: `Fine tune in Pro: ${section}`, exact: true });
    await action.click();
    await expect(
      page.locator('#root').getByTestId('editor-mode').locator('input[value="pro"]'),
    ).toBeChecked();
    const heading = page
      .locator('#root [data-testid="adjustment-settings"]')
      .getByRole('heading', { name: section, exact: true });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
  });
}

test('Simple font pages keep category choices, offline discovery, and wrapped dots usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.route('https://www.googleapis.com/webfonts/**', (route) => route.abort());
  await page.goto('/create');

  const pages = page.getByRole('group', { name: /Font page/ });
  await expect(pages.first()).toBeVisible();
  await expect(pages.first().getByRole('radio')).toHaveCount(3);
  await expect(pages.first()).toContainText(/Calligraphic|Handwritten|Rounded/);

  const dots = page.getByRole('button', { name: /Font page/ });
  const initialDotCount = await dots.count();
  expect(initialDotCount).toBeGreaterThan(1);
  const lastDot = dots.last();
  await lastDot.click();
  await expect(lastDot).toHaveAttribute('aria-current', 'page');

  const moreFonts = page.getByRole('button', { name: /^More fonts/ });
  await expect(moreFonts).toBeVisible();
  await moreFonts.click();
  await expect.poll(() => dots.count()).toBeGreaterThan(initialDotCount);

  const dotRows = await dots.evaluateAll((elements) => {
    const rows = new Set(
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
    return rows.size;
  });
  expect(dotRows).toBeGreaterThan(1);
});
