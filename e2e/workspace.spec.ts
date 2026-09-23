import { expect, test, type Page } from '@playwright/test';

const mockSellerWorkspace = async (page: Page) => {
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'seller-1', email: 'seller@example.com' } }),
    });
  });
  await page.route('**/api/presets', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        presets: [
          {
            id: 'preset-1',
            name: 'PLA contour',
            params: { templateId: 'name-keychain', styleId: 'contour', fontId: 'nunito' },
            print_profile_id: 'fdm-standard-0.4',
            created_at: '2026-09-04T00:00:00.000Z',
            updated_at: '2026-09-04T00:00:00.000Z',
          },
        ],
      }),
    });
  });
};

test('renders a signed-in seller workspace without sending order data to the API', async ({
  page,
}) => {
  await mockSellerWorkspace(page);

  await page.goto('/profile');

  await expect(page.getByRole('heading', { name: 'Your seller workspace' })).toBeVisible();
  await expect(page.locator('.profile-projects strong', { hasText: 'PLA contour' })).toBeVisible();
  await expect(page.getByLabel('Order CSV')).toHaveValue('order_id,text,quantity\n');
  await expect(
    page.getByText('CSV names, generated geometry, and the ZIP stay in this browser.'),
  ).toBeVisible();
});

test('keeps the seller workspace visible while preset navigation loads Customizer', async ({
  page,
}) => {
  test.skip(process.env.PLAYWRIGHT_HOSTED_MODE !== 'true');
  await mockSellerWorkspace(page);

  let releaseChunk: (() => void) | undefined;
  let markChunkRequested: (() => void) | undefined;
  const heldChunk = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  const chunkRequested = new Promise<void>((resolve) => {
    markChunkRequested = resolve;
  });
  await page.route('**/assets/CustomizerPage-*.js', async (route) => {
    markChunkRequested?.();
    await heldChunk;
    await route.continue();
  });

  await page.goto('/profile?lang=en');
  await expect(page.getByRole('heading', { name: 'Your seller workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Use settings' }).click();
  await chunkRequested;
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator('.profile-page')).toBeVisible();
  await expect(page.locator('[data-route-skeleton="customizer"]')).toHaveCount(0);

  releaseChunk?.();
  await expect(page.locator('header.customizer-topbar')).toBeVisible();
});
