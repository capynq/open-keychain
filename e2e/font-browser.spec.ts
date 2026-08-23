import { expect, test } from '@playwright/test';

test('shows the expanded built-in catalog and optional filters', async ({ page }) => {
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  await expect(fontSection.getByRole('tablist', { name: 'Font source' })).toBeVisible();
  await expect(fontSection.getByRole('tab', { name: 'Built-in' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(fontSection.getByRole('tab', { name: 'Local fonts' })).toBeVisible();

  const pagination = fontSection.getByRole('navigation', { name: 'Font pages' });
  await expect(pagination).toHaveCount(0);
  await expect(fontSection.locator('.font-card')).toHaveCount(23);
  const filters = fontSection.locator('details.font-filter-disclosure');
  await expect(filters).not.toHaveAttribute('open', '');
  await filters.locator('summary').click();
  await expect(filters).toHaveAttribute('open', '');

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

test('synchronizes primary and secondary font targets with subtitle compatibility', async ({
  page,
}) => {
  await page.goto('/create');
  const browser = page.getByTestId('font-browser');
  const shape = page.getByTestId('shape-settings');
  const subtitle = page.getByLabel('Subtitle or short message');
  await expect(browser.getByRole('radio')).toHaveCount(0);
  await expect(shape.getByRole('radio')).toHaveCount(0);
  await subtitle.fill('ROLE');
  await expect(browser.getByRole('radio', { name: 'Primary' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(shape.getByRole('radio', { name: 'Primary' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await shape.getByRole('radio', { name: 'Secondary' }).click();
  await expect(browser.getByRole('radio', { name: 'Secondary' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(shape.getByRole('radio', { name: 'Secondary' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(shape.getByLabel('Text size')).toHaveCount(0);
  await expect(subtitle).toBeVisible();

  await browser.getByRole('button', { name: 'Reset subtitle' }).click();
  await expect(browser.getByRole('radio')).toHaveCount(0);
  await subtitle.fill('ROLE');
  await expect(browser.getByRole('radio', { name: 'Primary' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await subtitle.fill('');
  await expect(browser.getByRole('radio')).toHaveCount(0);
  await expect(shape.getByRole('radio')).toHaveCount(0);
  await subtitle.fill('ROLE');
  await shape.getByRole('radio', { name: 'Secondary' }).click();
  await shape.getByRole('button', { name: 'Reset subtitle' }).click();
  await expect(browser.getByRole('radio')).toHaveCount(0);
  await expect(shape.getByRole('radio')).toHaveCount(0);
  await subtitle.fill('ROLE');
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(browser.getByRole('radio', { name: 'Secondary' })).toHaveCount(0);
  await expect(shape.getByRole('radio', { name: 'Secondary' })).toHaveCount(0);
});

test('shows the Google Fonts unavailable fallback and keeps built-in fonts available', async ({
  page,
}) => {
  await page.route('https://www.googleapis.com/webfonts/**', (route) => route.abort());
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const googleTab = fontSection.getByRole('tab', { name: 'Google Fonts' });
  await googleTab.click();
  await expect(googleTab).toHaveAttribute('aria-selected', 'true');
  await expect(fontSection.getByText(/Google Fonts are unavailable/)).toBeVisible();

  await fontSection.getByRole('tab', { name: 'Built-in' }).click();
  await expect(fontSection.locator('.font-card')).toHaveCount(23);
  await expect(fontSection.getByRole('button', { name: /Nunito/ })).toBeVisible();
});

test('loads, previews, and selects a mocked Google font without downloading it twice', async ({
  page,
}) => {
  let fontAssetRequests = 0;
  const items = Array.from({ length: 13 }, (_, index) => ({
    family: `Test Font ${String(index + 1).padStart(2, '0')}`,
    variants: ['700'],
    subsets: ['latin'],
    files: { '700': 'https://fonts.gstatic.com/s/open-keychain-test.ttf' },
  }));
  await page.route('https://www.googleapis.com/webfonts/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items }) }),
  );
  await page.route('https://fonts.gstatic.com/s/open-keychain-test.ttf', (route) => {
    fontAssetRequests += 1;
    return route.fulfill({ path: 'public/fonts/nunito.ttf', contentType: 'font/ttf' });
  });
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  await fontSection.getByRole('tab', { name: 'Built-in' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(fontSection.getByRole('tab', { name: 'Google Fonts' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(fontSection.locator('.font-card')).toHaveCount(12);
  await expect(fontSection.getByRole('navigation', { name: 'Font pages' })).toBeVisible();

  const card = fontSection.getByRole('button', { name: 'Select font: Test Font 01' });
  await card.hover();
  await expect.poll(() => fontAssetRequests).toBe(1);
  await page.evaluate(() => document.fonts.ready);
  await card.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(fontAssetRequests).toBe(1);
});

test('supports keyboard access for font source, search, and selection controls', async ({
  page,
}) => {
  await page.route('https://www.googleapis.com/webfonts/**', (route) => route.abort());
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const googleTab = fontSection.getByRole('tab', { name: 'Google Fonts' });
  await googleTab.focus();
  await page.keyboard.press('Enter');
  await expect(googleTab).toHaveAttribute('aria-selected', 'true');
  await expect(fontSection.getByText(/Google Fonts are unavailable/)).toBeVisible();

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
  await expect(fontCard).toHaveAttribute('aria-pressed', 'true');
});

test('uses the complete tab keyboard model and exposes pressed choices', async ({ page }) => {
  await page.route('https://www.googleapis.com/webfonts/**', (route) => route.abort());
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const builtIn = fontSection.getByRole('tab', { name: 'Built-in' });
  const google = fontSection.getByRole('tab', { name: 'Google Fonts' });
  await builtIn.focus();
  await page.keyboard.press('ArrowRight');
  await expect(google).toBeFocused();
  await expect(google).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(builtIn).toBeFocused();
  await expect(builtIn).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  const localFiles = fontSection.getByRole('tab', { name: 'Local fonts' });
  await expect(localFiles).toBeFocused();
  await expect(localFiles).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(builtIn).toBeFocused();
  await expect(builtIn).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(google).toBeFocused();
  await expect(google).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /Name keychain/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /Contour/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('imports a local font for this session and keeps local-font guidance collapsed', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/create');

  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  await fontSection.getByRole('tab', { name: 'Local fonts' }).click();
  const about = fontSection.locator('details.font-local-about');
  await expect(about).not.toHaveAttribute('open', '');
  await about.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(about).toHaveAttribute('open', '');
  await expect(about).toContainText('moved or deleted');

  const chooser = fontSection.locator('input[type="file"]');
  await chooser.setInputFiles('public/fonts/nunito.ttf');
  const imported = fontSection.locator('.font-card').first();
  await expect(imported).toBeVisible();
  await imported.click();
  await expect(imported).toHaveAttribute('aria-pressed', 'true');
});

test('keeps localized control names and touch targets usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');

  await expect(page.getByLabel('Name or text')).toBeVisible();
  const language = page.locator('.language-picker select');
  await language.selectOption('ru');
  await expect(page.getByLabel('Имя или текст')).toBeVisible();
  await expect(page.getByLabel('Элементы настройки')).toBeVisible();
  await language.selectOption('uk');
  await expect(page.getByLabel('Ім’я або текст')).toBeVisible();

  await language.selectOption('en');
  const fontSection = page.locator('.control-section').filter({ hasText: /^Font\s/ });
  const targets = fontSection.locator(
    '.reset-icon-button, .font-source-tabs button, .font-filter-disclosure > summary',
  );
  const sizes = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }
});

test('keeps the preview first at tablet width without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto('/create');
  await expect(page.locator('.preview-panel')).toBeVisible();
  await expect(page.locator('.controls-panel')).toBeVisible();

  const layout = await page.evaluate(() => {
    const preview = document.querySelector('.preview-panel')!.getBoundingClientRect();
    const controls = document.querySelector('.controls-panel')!.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      previewTop: preview.top,
      controlsTop: controls.top,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.previewTop).toBeLessThan(layout.controlsTop);
});
