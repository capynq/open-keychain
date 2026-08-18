import { expect, test } from '@playwright/test';

test('browses built-in fonts with pagination and filters', async ({ page }) => {
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  await expect(fontSection.getByRole('tablist', { name: 'Font source' })).toBeVisible();
  await expect(fontSection.getByRole('tab', { name: 'Built-in' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const pagination = fontSection.getByRole('navigation', { name: 'Font pages' });
  await expect(pagination).toHaveCount(0);
  await expect(fontSection.locator('.font-card')).toHaveCount(23);

  const category = fontSection.getByRole('combobox', { name: 'Category' });
  await category.selectOption('Serif');
  await expect(pagination).toHaveCount(0);
  await expect(fontSection.locator('.font-card')).toHaveCount(1);
  await expect(fontSection.getByRole('button', { name: /Bree Serif/ })).toBeVisible();

  const search = fontSection.getByRole('searchbox', { name: 'Search fonts' });
  await search.fill('Bungee');
  await expect(fontSection.locator('.font-card')).toHaveCount(0);
  await expect(fontSection.getByText('No compatible fonts found.')).toBeVisible();
});

test('shows the Google Fonts no-key fallback and keeps built-in fonts available', async ({
  page,
}) => {
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const googleTab = fontSection.getByRole('tab', { name: 'Google Fonts' });
  await googleTab.click();
  await expect(googleTab).toHaveAttribute('aria-selected', 'true');
  await expect(
    fontSection.getByText(/Google Fonts are unavailable \(missing key or blocked request\)/),
  ).toBeVisible();

  await fontSection.getByRole('tab', { name: 'Built-in' }).click();
  await expect(fontSection.locator('.font-card')).toHaveCount(23);
  await expect(fontSection.getByRole('button', { name: /Nunito/ })).toBeVisible();
});

test('supports keyboard access for font source, search, and selection controls', async ({
  page,
}) => {
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const googleTab = fontSection.getByRole('tab', { name: 'Google Fonts' });
  await googleTab.focus();
  await page.keyboard.press('Enter');
  await expect(googleTab).toHaveAttribute('aria-selected', 'true');
  await expect(
    fontSection.getByText(/Google Fonts are unavailable \(missing key or blocked request\)/),
  ).toBeVisible();

  const localTab = fontSection.getByRole('tab', { name: 'Built-in' });
  await localTab.focus();
  await page.keyboard.press('Enter');
  await expect(localTab).toHaveAttribute('aria-selected', 'true');

  const search = fontSection.getByRole('searchbox', { name: 'Search fonts' });
  await search.fill('Bungee');
  const fontCard = fontSection.getByRole('button', { name: /Bungee/ });
  await expect(fontCard).toBeVisible();
  await fontCard.focus();
  await page.keyboard.press('Space');
  await expect(fontCard).toHaveClass(/selected/);
});
