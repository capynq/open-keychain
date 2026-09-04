import { expect, test } from '@playwright/test';

test('renders a signed-in seller workspace without sending order data to the API', async ({
  page,
}) => {
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

  await page.goto('/profile');

  await expect(page.getByRole('heading', { name: 'Your seller workspace' })).toBeVisible();
  await expect(page.locator('.profile-projects strong', { hasText: 'PLA contour' })).toBeVisible();
  await expect(page.getByLabel('Order CSV')).toHaveValue('order_id,text,quantity\n');
  await expect(
    page.getByText('CSV names, generated geometry, and the ZIP stay in this browser.'),
  ).toBeVisible();
});
