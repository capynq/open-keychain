import { expect, test } from '@playwright/test';

test('generates and exports through the deployed nginx image', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open Keychain' })).toBeVisible();
  await expect(page.locator('.landing-button-primary')).toBeVisible();
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  await expect(dialog).toBeVisible();

  const stlDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  expect((await stlDownload).suggestedFilename()).toMatch(/\.stl$/);

  const threeMfDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /3MF · merged object/ }).click();
  expect((await threeMfDownload).suggestedFilename()).toMatch(/\.3mf$/);
});
