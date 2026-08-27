import { expect, test, type Page } from '@playwright/test';
import { waitForImageToLoad, watchBrowserErrors } from './helpers';

const carousel = '.configurator-carousel';
const activeSlide = '[data-showcase-slide][data-active="true"]';

const waitForSlide = async (page: Page, id: string) => {
  await expect(page.locator(`[data-showcase-slide="${id}"][data-active="true"]`)).toBeVisible();
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'false');
};

test('provides three stable, fully framed showcase slides', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');

  const slides = page.locator('[data-showcase-slide]');
  await expect(slides).toHaveCount(3);
  await expect(slides.filter({ has: page.locator('img[src$="example_1.jpeg"]') })).toHaveCount(1);
  await expect(slides.filter({ has: page.locator('img[src$="example_2.jpeg"]') })).toHaveCount(1);
  await expect(
    page.locator('[data-showcase-slide="configurator"][data-active="true"]'),
  ).toBeVisible();
  await waitForImageToLoad(page.locator(`${activeSlide} img`));

  const mediaBounds = await page.locator('[data-showcase-slide]').evaluateAll((elements) =>
    elements.map((element) => {
      const media = element.querySelector('.configurator-carousel-media')?.getBoundingClientRect();
      const image = element
        .querySelector('.configurator-carousel-media img')
        ?.getBoundingClientRect();
      return media && image
        ? {
            mediaWidth: media.width,
            mediaHeight: media.height,
            imageWidth: image.width,
            imageHeight: image.height,
          }
        : undefined;
    }),
  );
  for (const bounds of mediaBounds) {
    expect(bounds).toBeDefined();
    expect(Math.abs(bounds!.mediaWidth - bounds!.imageWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds!.mediaHeight - bounds!.imageHeight)).toBeLessThanOrEqual(1);
  }
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  assertNoBrowserErrors();
});

test('keeps controls single-step, wrapped, and locked while moving', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  const next = page.locator('[data-showcase-control="next"]');
  const previous = page.locator('[data-showcase-control="previous"]');
  const dots = page.locator('[data-showcase-control^="slide-"]');

  await next.click();
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'true');
  await next.hover();
  await previous.hover();
  await expect(next).toBeDisabled();
  await expect(previous).toBeDisabled();
  await waitForSlide(page, 'print-example-1');

  await next.click();
  await waitForSlide(page, 'print-example-2');
  await next.click();
  await waitForSlide(page, 'configurator');
  await previous.click();
  await waitForSlide(page, 'print-example-2');
  await dots.nth(0).click();
  await waitForSlide(page, 'configurator');
  await dots.nth(1).click();
  await waitForSlide(page, 'print-example-1');
  assertNoBrowserErrors();
});

test('supports keyboard and horizontal swipe navigation', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  const viewport = page.locator(carousel);
  await viewport.focus();
  await page.keyboard.press('ArrowRight');
  await waitForSlide(page, 'print-example-1');
  await page.keyboard.press('ArrowLeft');
  await waitForSlide(page, 'configurator');

  const bounds = await viewport.boundingBox();
  expect(bounds).toBeTruthy();
  const centerY = bounds!.y + bounds!.height / 2;
  const centerX = bounds!.x + bounds!.width / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - Math.min(180, bounds!.width / 2), centerY, { steps: 5 });
  await page.mouse.up();
  await waitForSlide(page, 'print-example-1');
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + Math.min(180, bounds!.width / 2), centerY, { steps: 5 });
  await page.mouse.up();
  await waitForSlide(page, 'configurator');
  assertNoBrowserErrors();
});

test('uses localized captions and instant reduced-motion controls', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.locator('[data-showcase-control="slide-2"]').click();
  await waitForSlide(page, 'print-example-1');
  await expect(page.locator('[data-showcase-slide="print-example-1"] img')).toHaveAttribute(
    'alt',
    /Фотография/,
  );
  await expect(page.locator('.configurator-showcase-caption')).toContainText('Напечатанный');
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'false');
  assertNoBrowserErrors();
});
