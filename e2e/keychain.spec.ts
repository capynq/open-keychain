import { expect, test } from '@playwright/test';

const cameraViews = ['Home view', 'Front view', 'Back view', 'Left view', 'Right view', 'Top view', 'Bottom view'];

test('customizes a name, uses every icon camera preset, and downloads STL', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Open Keychain')).toBeVisible();
  const name = page.getByLabel('Name or text');
  await name.fill('OLIVER');
  await page.getByRole('button', { name: 'Capsule' }).click();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10_000 });
  const viewer = page.locator('.viewer');
  for (const label of cameraViews) {
    const button = page.getByRole('button', { name: label });
    await expect(button.locator('svg[data-icon]')).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(viewer).toHaveAttribute('data-view', 'bottom');
  const surface = page.locator('.viewer-surface');
  const surfaceBox = await surface.boundingBox();
  expect(surfaceBox).toBeTruthy();
  await page.mouse.move(surfaceBox!.x + surfaceBox!.width * 0.5, surfaceBox!.y + surfaceBox!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(surfaceBox!.x + surfaceBox!.width * 0.18, surfaceBox!.y + surfaceBox!.height * 0.38, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(viewer).toHaveAttribute('data-view', 'custom');
  await expect(surface.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Download STL/ })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download STL/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^keychain-oliver-capsule\.stl$/);
});

test('treats adjusted NIKITA Bubble geometry as ready and a width failure as an error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name or text').fill('NIKITA');
  await page.getByRole('button', { name: 'Bubble' }).click();
  await page.getByRole('button', { name: /Bungee/ }).click();
  await expect(page.getByText('Ready · adjusted')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/adjusted to .* mm high/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Download STL/ })).toBeEnabled();

  await page.getByLabel('Name height').fill('12');
  await page.getByLabel('Name or text').fill('WWWWWWWWWWWWWWWWWWWWWWWW');
  await expect(page.getByText('Needs attention')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/cannot fit within 120 mm/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Download STL/ })).toBeDisabled();
});

test('switches to a bilingual font when Cyrillic text is entered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Bungee/ }).click();
  await page.getByLabel('Name or text').fill('НИКИТА');
  await expect(page.getByRole('button', { name: /Bungee/ })).toBeDisabled();
  await expect(page.getByText(/Bungee does not include Cyrillic/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Caveat/ })).toBeEnabled();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10_000 });
});

test('supports bounded zoom, preview surfaces, locales, and configurable 3MF export', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ready to print')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.getByRole('button', { name: '3MF' }).click();
  await page.getByRole('combobox', { name: 'Режим 3MF' }).selectOption('merged');
  await expect(page.getByRole('button', { name: /Скачать 3MF/ })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Скачать 3MF/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.3mf$/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
]) {
  test(`keeps all desktop controls visible at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('Ready to print')).toBeVisible({ timeout: 10_000 });
    const layout = await page.evaluate(() => {
      const controls = document.querySelector('.controls-panel')!.getBoundingClientRect();
      const download = document.querySelector('.download-bar')!.getBoundingClientRect();
      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        controlsTop: controls.top,
        controlsBottom: controls.bottom,
        downloadTop: download.top,
        downloadBottom: download.bottom,
      };
    });
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.controlsTop).toBeGreaterThanOrEqual(0);
    expect(layout.controlsBottom).toBeLessThanOrEqual(layout.downloadTop);
    expect(layout.downloadBottom).toBeLessThanOrEqual(layout.viewportHeight);
    await expect(page.getByRole('button', { name: /Download STL/ })).toBeVisible();
    await expect(page.getByLabel('Keyring hole')).toBeVisible();
  });
}

test('keeps the preview prominent and touch targets comfortable at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.viewer')).toBeVisible();
  const dimensions = await page
    .locator('.viewer')
    .evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));
  expect(dimensions.height).toBeLessThanOrEqual(500);
  expect(dimensions.width).toBeGreaterThan(300);
  const cameraButtonHeight = await page
    .getByRole('button', { name: 'Home view' })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(cameraButtonHeight).toBeGreaterThanOrEqual(44);
});
