import { expect, test } from '@playwright/test';

test('shows the localized recovery action when the app entry is aborted', async ({ page }) => {
  await page.route('**/assets/app-*.js', (route) => route.abort());

  await page.goto('/create?lang=ru', { waitUntil: 'commit' });

  const recovery = page.locator('#boot-recovery');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Open Keychain не удалось запустить');
  const card = recovery.locator('.boot-recovery__card');
  const cardBounds = await card.boundingBox();
  expect(cardBounds).not.toBeNull();
  expect(cardBounds!.x).toBeGreaterThanOrEqual(16);
  expect(cardBounds!.y).toBeGreaterThanOrEqual(16);
  expect(cardBounds!.x + cardBounds!.width).toBeLessThanOrEqual(
    (await page.viewportSize())!.width - 16,
  );
  expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(
    (await page.viewportSize())!.height - 16,
  );
  await page.keyboard.press('Tab');
  await expect(recovery.getByRole('button', { name: 'Перезагрузить' })).toBeFocused();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
});

test('shows recovery for an app runtime error before React is ready', async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener(
      'error',
      (event) => {
        if (event.message === 'boot runtime regression') event.preventDefault();
      },
      true,
    );
  });
  await page.route('**/assets/app-*.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: "throw new Error('boot runtime regression');",
    });
  });

  await page.goto('/create?lang=uk', { waitUntil: 'commit' });

  await expect(page.locator('#boot-recovery')).toBeVisible();
  await expect(page.locator('#boot-recovery')).toContainText('Open Keychain не вдалося запустити');
});

test('shows recovery after timeout and hides it after a later successful handoff', async ({
  page,
}) => {
  let releaseAppEntry: (() => void) | undefined;
  const heldEntry = new Promise<void>((resolve) => {
    releaseAppEntry = resolve;
  });
  await page.route('**/assets/app-*.js', async (route) => {
    await heldEntry;
    await route.continue();
  });

  await page.goto('/create', { waitUntil: 'commit' });
  await expect(page.locator('#boot-recovery')).toBeHidden();
  await page.waitForTimeout(12_500);
  await expect(page.locator('#boot-recovery')).toBeVisible();

  releaseAppEntry?.();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#boot-recovery')).toBeHidden();
  await expect(page.locator('#root header.customizer-topbar')).toBeVisible();
});

test('keeps recovery hidden on a normal app load', async ({ page }) => {
  await page.goto('/create');

  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#boot-recovery')).toBeHidden();
  await expect(page.locator('#root header.customizer-topbar')).toBeVisible();
});

test.describe('browser locale recovery', () => {
  test.use({ locale: 'ru-RU' });

  test('uses the browser locale on landing when the URL has no locale', async ({ page }) => {
    await page.route('**/assets/app-*.js', (route) => route.abort());

    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.locator('#boot-recovery')).toContainText(
      'Open Keychain не удалось запустить',
    );
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows only the no-JS message', async ({ page }) => {
    await page.goto('/create', { waitUntil: 'commit' });

    await expect(page.locator('#boot-no-js')).toBeVisible();
    await expect(page.locator('#boot-shell')).toBeHidden();
  });
});
