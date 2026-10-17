import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
  });
});

test('landing hover and keyboard focus stay spatially stable with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const action = page.locator('.landing-card-link').first();
  await expect(action).toBeVisible();
  await action.hover();
  await expect(action).toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await action.focus();
  await expect(action).toHaveCSS('transform', 'none');
  await expect(action).toHaveCSS('outline-style', 'solid');
});

test('Reference cards retain their baseline decoration under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/guides/');
  const card = page.locator('.seo-resource-card').first();
  await expect(card).toBeVisible();
  const baseline = await card.evaluate((element) => ({
    before: getComputedStyle(element, '::before').transform,
    after: getComputedStyle(element, '::after').transform,
  }));
  await card.hover();
  await expect(card).toHaveCSS('transform', 'none');
  expect(
    await card.evaluate((element) => ({
      before: getComputedStyle(element, '::before').transform,
      after: getComputedStyle(element, '::after').transform,
    })),
  ).toEqual(baseline);
  await page.mouse.move(0, 0);
  const link = card.locator('a').first();
  await page.keyboard.press('Tab');
  await link.focus();
  await expect(card).toHaveCSS('transform', 'none');
  await expect(link).toHaveCSS('outline-style', 'solid');
});

test('surface expansion indicates state while keeping keyboard and reduced-motion changes immediate', async ({
  page,
}) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  const trigger = page.locator('.surface-trigger');
  const arrow = trigger.locator('svg');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(arrow).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  await page.keyboard.press('Escape');
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(arrow).toHaveCSS('transition-duration', '0s');
  await expect(arrow).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(arrow).toHaveCSS('transition-duration', '0s');
});

test.describe('large touch hover behavior', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 900 } });

  test('public cards do not move when touch produces hover state', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.landing-template-card').first();
    await expect(card).toBeVisible();
    await card.hover();
    await expect(card).toHaveCSS('transform', 'none');
    const carousel = page.locator('.configurator-carousel');
    await carousel.hover();
    const resting = await carousel.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.down();
    try {
      await carousel.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
      });
      await expect(carousel).toHaveCSS('transform', resting);
    } finally {
      await page.mouse.up();
    }
    await page.goto('/templates/name-keychain/');
    const feature = page.locator('.seo-feature-card').first();
    await expect(feature).toBeVisible();
    await feature.hover();
    await expect(feature).toHaveCSS('transform', 'none');
  });
});
