import { expect, test, type Page } from '@playwright/test';

import { selectLocale, waitForImageToLoad, watchBrowserErrors, gotoLive } from './helpers';

const carousel = '.configurator-carousel';
const activeSlide = '[data-showcase-slide][data-active="true"]';

const waitForSlide = async (page: Page, id: string) => {
  await expect(page.locator(`[data-showcase-slide="${id}"][data-active="true"]`)).toBeVisible();
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'false');
};

test('provides three stable, fully framed showcase slides', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await gotoLive(page, '/');

  const slides = page.locator('[data-showcase-slide]');
  await expect(slides).toHaveCount(3);
  await expect(slides.filter({ has: page.locator('img[src$="example_1-en.png"]') })).toHaveCount(1);
  await expect(slides.filter({ has: page.locator('img[src$="example_2-en.png"]') })).toHaveCount(1);
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

test('uses a named carousel region with localized slide groups', async ({ page }) => {
  await gotoLive(page, '/');

  const region = page.getByRole('region', { name: 'Open Keychain customizer preview' });
  await expect(region).toHaveAttribute('aria-roledescription', 'carousel');
  await expect(region.locator('figure')).toHaveCount(1);
  const slides = region.locator('[data-showcase-slide]');
  await expect(slides).toHaveCount(3);

  for (const index of [0, 1, 2]) {
    const slide = slides.nth(index);
    await expect(slide).toHaveAttribute('role', 'group');
    await expect(slide).toHaveAttribute('aria-roledescription', 'slide');
    await expect(slide).toHaveAttribute('aria-label', `Slide ${index + 1} of 3`);
  }
});

test('keeps controls single-step, wrapped, and locked while moving', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await gotoLive(page, '/');
  const next = page.locator('[data-showcase-control="next"]');
  const previous = page.locator('[data-showcase-control="previous"]');
  const dots = page.locator('[data-showcase-control^="slide-"]');

  /* Record the controls in the page whenever anything changes while the carousel moves: a 20-frame
   * scroll can settle before a test action lands on a loaded runner. */
  await page.evaluate((selector) => {
    const viewport = document.querySelector(selector)!;
    const states: boolean[] = [];
    (window as unknown as { __lockedWhileMoving: boolean[] }).__lockedWhileMoving = states;
    new MutationObserver(() => {
      if (viewport.getAttribute('data-moving') !== 'true') return;
      states.push(
        [...document.querySelectorAll<HTMLButtonElement>('[data-showcase-control]')].every(
          (control) => control.disabled,
        ),
      );
    }).observe(viewport.closest('section') ?? document.body, {
      attributes: true,
      attributeFilter: ['data-moving', 'disabled'],
      subtree: true,
    });
  }, carousel);
  await next.click();
  await next.hover();
  await previous.hover();
  await waitForSlide(page, 'print-example-1');
  const lockedWhileMoving = await page.evaluate(
    () => (window as unknown as { __lockedWhileMoving: boolean[] }).__lockedWhileMoving,
  );
  expect(lockedWhileMoving.length).toBeGreaterThan(0);
  expect(lockedWhileMoving.every(Boolean)).toBe(true);

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
  await gotoLive(page, '/');
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
  /* Past half a slide, so the drag snaps by distance: Embla only counts a release as a flick
   * within 170 ms of the last move, which a loaded runner can miss. */
  const swipe = bounds!.width * 0.6;
  const pageWidth = page.viewportSize()!.width;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(Math.max(1, centerX - swipe), centerY, { steps: 5 });
  await page.mouse.up();
  await waitForSlide(page, 'print-example-1');
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(Math.min(pageWidth - 1, centerX + swipe), centerY, { steps: 5 });
  await page.mouse.up();
  await waitForSlide(page, 'configurator');
  assertNoBrowserErrors();
});

test('uses localized captions and instant reduced-motion controls', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoLive(page, '/');
  await selectLocale(page, 'ru');
  await page.locator('[data-showcase-control="slide-2"]').click();
  await waitForSlide(page, 'print-example-1');
  await expect(page.locator('[data-showcase-slide="print-example-1"] img')).toHaveAttribute(
    'src',
    /example_1\.png$/,
  );
  await expect(page.locator('[data-showcase-slide="print-example-1"] img')).toHaveAttribute(
    'alt',
    /Фотография/,
  );
  await expect(page.locator('.configurator-showcase-caption')).toContainText('Напечатанный');
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'false');
  assertNoBrowserErrors();
});
