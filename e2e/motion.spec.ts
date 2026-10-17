import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
  });
});

test('keyboard card focus and font pagination scroll instantly; pointer pagination stays smooth', async ({
  page,
}) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.getByTestId('simple-font-picker')).toBeVisible();
  const card = page.locator('.design-select-card').first();
  await card.evaluate((element) => {
    element.scrollIntoView = (options) => {
      element.setAttribute(
        'data-scroll-behavior',
        typeof options === 'object' ? (options.behavior ?? '') : '',
      );
    };
  });
  await page.keyboard.press('Tab');
  await card.focus();
  await expect(card).toHaveAttribute('data-scroll-behavior', 'instant');

  const picker = page.getByTestId('simple-font-picker');
  await picker.evaluate((element) => {
    const pages = element.querySelector('[class*="pages"]')!;
    pages.scrollTo = (options) => {
      element.setAttribute(
        'data-scroll-behavior',
        typeof options === 'object' ? (options.behavior ?? '') : '',
      );
    };
  });
  const dot = picker.getByRole('button', { name: /Font page 2/ });
  await dot.focus();
  await dot.press('Enter');
  await expect(picker).toHaveAttribute('data-scroll-behavior', 'instant');
  await picker.getByRole('button', { name: /Font page 1/ }).click();
  await expect(picker).toHaveAttribute('data-scroll-behavior', 'smooth');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dot.click();
  await expect(picker).toHaveAttribute('data-scroll-behavior', 'instant');
});

test('setup keyboard entry and step navigation have no movement', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  const trigger = page.getByRole('button', { name: 'Open quick setup' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByTestId('quick-setup-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(dialog.locator('[class*="stepFrame"]')).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(dialog).toHaveCSS('animation-duration', '0.2s');
  await expect(dialog.locator('[class*="stepFrame"]')).toHaveCSS('animation-name', 'none');
});

test('rail and Pro navigation distinguish keyboard from pointer activation', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  const next = page.locator('[data-icon-action="design-card-rail-next"]').first();
  if (await next.isVisible()) {
    const shell = page.locator('.design-card-rail-shell').first();
    await shell.locator('.design-card-rail').evaluate((element) => {
      element.scrollBy = (options) => {
        element.setAttribute(
          'data-scroll-behavior',
          typeof options === 'object' ? (options.behavior ?? '') : '',
        );
      };
    });
    await next.click();
    await expect(shell.locator('.design-card-rail')).toHaveAttribute(
      'data-scroll-behavior',
      'smooth',
    );
    await next.press('Enter');
    await expect(shell.locator('.design-card-rail')).toHaveAttribute(
      'data-scroll-behavior',
      'instant',
    );
  }
  await page.evaluate(() => {
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) {
      if (this.matches('h2, h3'))
        this.setAttribute(
          'data-scroll-behavior',
          typeof options === 'object' ? (options.behavior ?? '') : '',
        );
      scroll.call(this, options);
    };
  });
  const action = page.getByRole('button', { name: 'Fine tune in Pro: Typography', exact: true });
  await action.focus();
  await action.press('Enter');
  const heading = page
    .getByTestId('adjustment-settings')
    .getByRole('heading', { name: 'Typography', exact: true });
  await expect(heading).toHaveAttribute('data-scroll-behavior', 'instant');
  await page.getByTestId('editor-mode').getByText('Simple', { exact: true }).click();
  await action.click();
  await expect(heading).toHaveAttribute('data-scroll-behavior', 'smooth');
});

test('discovery reveals only the visible new cards and never replays them', async ({ page }) => {
  await page.route('https://www.googleapis.com/webfonts/**', (route) => route.abort());
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  const picker = page.getByTestId('simple-font-picker');
  await picker.evaluate((element) => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this instanceof HTMLElement && this.dataset.fontId) {
        const count = Number(element.getAttribute('data-reveal-count') ?? 0);
        element.setAttribute('data-reveal-count', String(count + 1));
        const timing = typeof options === 'object' ? options : {};
        element.setAttribute(
          'data-last-reveal-end',
          String(Number(timing?.duration ?? 0) + Number(timing?.delay ?? 0)),
        );
      }
      return animate.call(this, frames, options);
    };
  });
  const dots = picker.getByRole('button', { name: /Font page/ });
  const oldCount = await dots.count();
  await dots.last().click();
  const more = picker.getByRole('button', { name: /^More fonts/ });
  await expect(more).toBeInViewport();
  await more.click();
  await expect.poll(() => dots.count()).toBeGreaterThan(oldCount);
  await expect
    .poll(async () => Number(await picker.getAttribute('data-reveal-count')))
    .toBeGreaterThan(0);
  const count = Number(await picker.getAttribute('data-reveal-count'));
  expect(count).toBeLessThanOrEqual(3);
  expect(Number(await picker.getAttribute('data-last-reveal-end'))).toBeLessThanOrEqual(260);
  await dots.first().click();
  await dots.nth(oldCount).click();
  expect(Number(await picker.getAttribute('data-reveal-count'))).toBe(count);
});

test('shared icon motion stops for keyboard and live reduced motion', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  const button = page.getByRole('button', { name: 'Share', exact: true });
  await button.click({ trial: true });
  await button.dispatchEvent('pointerdown', { bubbles: true });
  await button.hover();
  if (await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    await expect(button).not.toHaveCSS('transform', 'none');
  } else {
    await expect(button).toHaveCSS('transform', 'none');
  }
  await page.keyboard.press('Tab');
  await expect(button).toHaveCSS('transform', 'none');
  if (await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    await page.mouse.move(0, 0);
    await button.hover();
    await expect(button).not.toHaveCSS('transform', 'none');
  }
  await button.dispatchEvent('pointerdown', { bubbles: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(button).toHaveCSS('transform', 'none');
  await expect(button.locator('svg')).toHaveCSS('transform', 'none');
});

test.describe('large touch viewport', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 900 } });

  test('does not lift cards or shared icons on hover', async ({ page }) => {
    await page.goto('/create');
    await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
    const card = page.locator('.design-select-card').first();
    await card.hover();
    await expect(card).toHaveCSS('transform', 'none');
    const share = page.getByRole('button', { name: 'Share', exact: true });
    await share.hover();
    await expect(share).toHaveCSS('transform', 'none');
  });
});
