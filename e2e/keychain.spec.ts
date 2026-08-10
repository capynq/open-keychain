import { expect, test } from '@playwright/test';
const cameraViews = [
  'Home view',
  'Front view',
  'Back view',
  'Left view',
  'Right view',
  'Top view',
  'Bottom view',
];
test('customizes a name, uses every icon camera preset, and downloads STL', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Open Keychain')).toBeVisible();
  await expect(page.locator('.brand-mark small')).toHaveCount(0);
  await expect(page.locator('.preview-heading h2')).toHaveText('LIVE PREVIEW');
  await expect(page.getByRole('heading', { name: 'ALEX' })).toHaveCount(0);
  const name = page.getByLabel('Name or text');
  await name.fill('OLIVER');
  await page.getByRole('button', { name: 'Capsule' }).click();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  const viewer = page.locator('.viewer');
  for (const label of cameraViews) {
    const button = page.getByRole('button', { name: label });
    await expect(button.locator('svg[data-icon]')).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(viewer).toHaveAttribute('data-view', 'bottom');
  const surface = page.locator('.viewer-surface');
  await surface.scrollIntoViewIfNeeded();
  const surfaceBox = await surface.boundingBox();
  expect(surfaceBox).toBeTruthy();
  await page.mouse.move(
    surfaceBox!.x + surfaceBox!.width * 0.5,
    surfaceBox!.y + surfaceBox!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    surfaceBox!.x + surfaceBox!.width * 0.18,
    surfaceBox!.y + surfaceBox!.height * 0.38,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await expect(viewer).toHaveAttribute('data-view', 'custom');
  await expect(surface.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /STL file/ })
    .click();
  expect((await download).suggestedFilename()).toMatch(/^keychain-oliver-capsule\.stl$/);
});
test('treats adjusted NIKITA Bubble geometry as ready and a width failure as an error', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Name or text').fill('NIKITA');
  await page.getByRole('button', { name: 'Bubble' }).click();
  await page.getByRole('button', { name: /Bungee/ }).click();
  await expect(page.getByText('Ready · adjusted')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/adjusted to .* mm high/)).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
  await page.getByLabel('Name height').fill('12');
  await page.getByLabel('Name or text').fill('WWWWWWWWWWWWWWWWWWWWWWWW');
  await expect(page.getByText('Needs attention')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/cannot fit within 120 mm/)).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Close' }).click();
});
test('switches to a bilingual font when Cyrillic text is entered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Bungee/ }).click();
  await page.getByLabel('Name or text').fill('НИКИТА');
  await expect(page.getByRole('button', { name: /Bungee/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Rubik Black/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Caveat/ })).toBeVisible();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
});
test('selects a printable heavy font for articulated names and hides unsuitable choices', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Caveat/ }).click();
  await expect(page.getByRole('button', { name: /Caveat/ })).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('button', { name: 'Articulated name' })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: /Bungee/ })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: /Caveat/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nunito/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fredoka/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Bungee/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Montserrat Black/ })).toBeEnabled();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
});
test('supports bounded zoom, preview surfaces, locales, and configurable 3MF export', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Ready to print')).toBeVisible({ timeout: 10000 });
  for (let click = 0; click < 8; click += 1)
    await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.getByRole('button', { name: 'Экспорт' }).click();
  await expect(page.getByRole('dialog', { name: 'Выберите экспорт' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /3MF · единый объект/ }),
  ).toBeEnabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /3MF · единый объект/ })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.3mf$/);
});
test('supports beta templates and premium local scene presets', async ({ page }) => {
  await page.goto('/');
  for (const template of ['Articulated name', 'Nameplate', 'Plant label', 'Name keychain']) {
    await page.getByRole('button', { name: template }).click();
    await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
    if (template === 'Nameplate')
      await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Wood board' }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'wood');
  await page.getByRole('button', { name: 'Metal board' }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'metal');
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
});
test('scopes styles to supported templates and keeps the Montserrat preview visible', async ({
  page,
}) => {
  await page.goto('/');
  const readMontserratPreview = async () => {
    const montserrat = page.getByRole('button', { name: /Montserrat Black/ });

    await expect(montserrat).toBeVisible();
    return montserrat.locator('span').evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        width: element.getBoundingClientRect().width,
        family: style.fontFamily,
        weight: style.fontWeight,
      };
    });
  };

  const nameKeychainPreview = await readMontserratPreview();
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  const montserrat = page.getByRole('button', { name: /Montserrat Black/ });
  await expect(montserrat).toBeVisible();
  const articulatedPreview = await readMontserratPreview();
  expect(nameKeychainPreview.width).toBeGreaterThan(0);
  expect(articulatedPreview.width).toBeGreaterThan(0);
  expect(nameKeychainPreview.family).toBe(articulatedPreview.family);
  expect(nameKeychainPreview.weight).toBe(articulatedPreview.weight);
  await page.getByRole('button', { name: 'Nameplate' }).click();
  await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  await expect(page.getByLabel('Keyring hole')).toHaveCount(0);
  await expect(page.getByLabel('Text tilt')).toBeVisible();
  await expect(page.getByLabel('Text lift')).toBeVisible();
  await expect(page.getByLabel('Embed depth')).toBeVisible();
});
test('renders the plant label as a pointed T-shaped printable template', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plant label' }).click();
  await expect(page.getByLabel('Stake length')).toBeVisible();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
});
test('shows only template-relevant shape controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plant label' }).click();
  await expect(page.getByLabel('Keyring hole')).toHaveCount(0);
  await expect(page.getByLabel('Letter spacing')).toBeVisible();
  await expect(page.getByLabel('Stake length')).toBeVisible();
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByLabel('Keyring hole')).toBeVisible();
  await expect(page.getByLabel('Letter spacing')).toHaveCount(0);
  await expect(page.getByLabel('Border padding')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nameplate' }).click();
  await expect(page.getByLabel('Corner radius')).toBeVisible();
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
]) {
  test(`keeps all desktop controls visible at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('Ready to print')).toBeVisible({ timeout: 10000 });
    const layout = await page.evaluate(() => {
      const controls = document.querySelector('.controls-panel')!.getBoundingClientRect();
      const header = document.querySelector('.topbar')!.getBoundingClientRect();
      const exportButton = document.querySelector('.export-header-button')!.getBoundingClientRect();
      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        headerTop: header.top,
        headerBottom: header.bottom,
        controlsTop: controls.top,
        controlsBottom: controls.bottom,
        exportTop: exportButton.top,
        exportBottom: exportButton.bottom,
        exportCenter: (exportButton.left + exportButton.right) / 2,
        viewportCenter: window.innerWidth / 2,
      };
    });
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.controlsTop).toBeGreaterThanOrEqual(0);
    expect(layout.headerTop).toBeGreaterThanOrEqual(0);
    expect(layout.headerBottom).toBeLessThanOrEqual(layout.controlsTop);
    expect(layout.exportTop).toBeGreaterThanOrEqual(layout.headerTop);
    expect(layout.exportBottom).toBeLessThanOrEqual(layout.headerBottom);
    expect(Math.abs(layout.exportCenter - layout.viewportCenter)).toBeLessThanOrEqual(1);
    expect(layout.exportBottom - layout.exportTop).toBeGreaterThanOrEqual(36);
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(page.getByLabel('Keyring hole')).toBeVisible();
  });
}
test('keeps the complete articulated shape control set reachable in the scrollable pane', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Articulated name' }).click();
  const controls = page.locator('.controls-panel');
  const metrics = await controls.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  await controls.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByLabel('Max joint angle')).toBeVisible();
});
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
