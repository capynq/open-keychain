import { expect, test } from '@playwright/test';
import { ROUTE_MANIFEST } from '../src/app/routes';
import {
  waitForImageToLoad,
  waitForLocalFonts,
  waitForReadyGeometry,
  selectLocale,
  watchBrowserErrors,
} from './helpers';

const activeHeroImageSelector =
  '.configurator-carousel-slide[data-showcase-kind="configurator"][data-active="true"] img';

test('renders every declared route without browser errors', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  for (const route of ROUTE_MANIFEST) {
    await page.goto(route.path);
    await waitForLocalFonts(page);
    await expect(page.getByRole('main')).toBeVisible();

    if (route.id === 'landing') {
      await expect(page).toHaveTitle('Open Keychain 3D | Name keychain maker');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.landing-button-primary')).toBeVisible();
    } else {
      await expect(page).toHaveTitle('Open Keychain 3D | Create a keychain');
      await expect(page.getByRole('main', { name: 'Customizer' })).toBeVisible();
      await waitForReadyGeometry(page);
    }
  }

  assertNoBrowserErrors();
});

test('takes the primary landing call to action to the customizer', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  await page.getByRole('link', { name: 'Start designing' }).first().click();
  await expect(page).toHaveURL(/\/create$/);
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});

test('exposes a working customizer entry point for every landing template card', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  const expected = ['name-keychain', 'articulated-name', 'nameplate', 'plant-label'];
  const links = page.locator('.landing-template-card-action');
  await expect(links).toHaveCount(expected.length);
  for (const [index, templateId] of expected.entries()) {
    await expect(links.nth(index)).toHaveAttribute(
      'href',
      `/create?template=${templateId}&lang=en`,
    );
  }
  await links.nth(2).click();
  await expect(page).toHaveURL(/\/create\?template=nameplate&lang=en$/);
  await expect(page.locator('.template-grid button[aria-pressed="true"]')).toHaveAttribute(
    'data-testid',
    'template-card-nameplate',
  );
  assertNoBrowserErrors();
});

test('keeps source navigation in footers, not headers', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('header a[href="https://github.com/capynq/open-keychain"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('footer a[href="https://github.com/capynq/open-keychain"]'),
  ).toHaveCount(1);

  await page.goto('/create');
  await expect(
    page.locator('header a[href="https://github.com/capynq/open-keychain"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('footer a[href="https://github.com/capynq/open-keychain"]'),
  ).toHaveCount(1);
});

test('loads all reviewed landing visuals at the active responsive breakpoint', async ({
  page,
}, testInfo) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  await expect(page.locator('.landing-template-card img')).toHaveCount(4);
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      waitForImageToLoad(page.locator('.landing-template-card img').nth(index)),
    ),
    waitForImageToLoad(page.locator(activeHeroImageSelector)),
  ]);
  const images = await page.locator('.landing-template-card img').evaluateAll((elements) =>
    elements.map((element) => {
      const image = element as HTMLImageElement;
      return { src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight };
    }),
  );

  expect(images.every((image) => image.src.includes('/showcase/templates/'))).toBe(true);
  expect(images.every((image) => image.width > 0 && image.height > 0)).toBe(true);
  const expectedHeroAsset =
    testInfo.project.name === 'mobile-2x'
      ? 'create-mobile@2x.png'
      : testInfo.project.name === 'mobile'
        ? 'create-mobile.png'
        : 'create-desktop.png';
  await expect
    .poll(
      () =>
        page
          .locator(activeHeroImageSelector)
          .evaluate((element) => (element as HTMLImageElement).currentSrc),
      { timeout: 5_000 },
    )
    .toContain(expectedHeroAsset);
  await waitForImageToLoad(page.locator(activeHeroImageSelector));
  expect(
    await page
      .locator(activeHeroImageSelector)
      .evaluate((element) => (element as HTMLImageElement).currentSrc),
  ).toContain(expectedHeroAsset);
  const heroImageState = await page.locator(activeHeroImageSelector).evaluate((element) => {
    const image = element as HTMLImageElement;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      renderedWidth: image.clientWidth,
      renderedHeight: image.clientHeight,
      complete: image.complete,
    };
  });
  expect(heroImageState.complete).toBe(true);
  const expectedHeroDimensions =
    testInfo.project.name === 'mobile-2x'
      ? { width: 390, height: 844 }
      : testInfo.project.name === 'mobile'
        ? { width: 780, height: 1688 }
        : { width: 2880, height: 1800 };
  expect(heroImageState.width).toBe(expectedHeroDimensions.width);
  expect(heroImageState.height).toBe(expectedHeroDimensions.height);
  expect(heroImageState.width).toBeGreaterThan(heroImageState.renderedWidth);
  expect(heroImageState.height).toBeGreaterThan(heroImageState.renderedHeight);
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute('fetchpriority', 'high');
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute('loading', 'eager');
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute(
    'sizes',
    '(max-width: 760px) 100vw, 50vw',
  );
  await expect(page.locator('.configurator-window source')).toHaveAttribute(
    'srcset',
    /create-mobile\.png 1x, \/showcase\/create-mobile@2x\.png 2x/,
  );
  assertNoBrowserErrors();
});

test('uses the density-appropriate mobile customizer capture on a mobile landing viewport', async ({
  page,
}, testInfo) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.landing-template-card img')).toHaveCount(4);
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      waitForImageToLoad(page.locator('.landing-template-card img').nth(index)),
    ),
    waitForImageToLoad(page.locator(activeHeroImageSelector)),
  ]);
  const expectedHeroAsset =
    testInfo.project.name === 'mobile-2x' ? 'create-mobile@2x.png' : 'create-mobile.png';
  await expect
    .poll(
      () =>
        page
          .locator(activeHeroImageSelector)
          .evaluate((element) => (element as HTMLImageElement).currentSrc),
      { timeout: 5_000 },
    )
    .toContain(expectedHeroAsset);
  await waitForImageToLoad(page.locator(activeHeroImageSelector));
  expect(
    await page
      .locator(activeHeroImageSelector)
      .evaluate((element) => (element as HTMLImageElement).currentSrc),
  ).toContain(expectedHeroAsset);
  const imageState = await page.locator(activeHeroImageSelector).evaluate((element) => {
    const image = element as HTMLImageElement;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      renderedWidth: image.clientWidth,
      renderedHeight: image.clientHeight,
    };
  });
  // Browsers expose density-corrected intrinsic dimensions for a 2x srcset candidate.
  const expectedMobileIntrinsicDimensions =
    testInfo.project.name === 'mobile-2x'
      ? { width: 390, height: 844 }
      : { width: 780, height: 1688 };
  expect(imageState.width).toBe(expectedMobileIntrinsicDimensions.width);
  expect(imageState.height).toBe(expectedMobileIntrinsicDimensions.height);
  expect(imageState.width).toBeGreaterThan(imageState.renderedWidth);
  expect(imageState.height).toBeGreaterThan(imageState.renderedHeight);
  expect(
    await page.locator(activeHeroImageSelector).evaluate((element) => {
      const image = element as HTMLImageElement;
      return image.currentSrc.endsWith('/showcase/create-mobile.png');
    }),
  ).toBe(testInfo.project.name !== 'mobile-2x');
  assertNoBrowserErrors();
});

test('redirects an unknown path to the landing page', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/not-a-route');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  assertNoBrowserErrors();
});

test('keeps the customizer title when its path has a trailing slash', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/create/');
  await expect(page).toHaveTitle('Open Keychain 3D | Create a keychain');
  assertNoBrowserErrors();
});

test('updates the localized landing title', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  await selectLocale(page, 'ru');
  await expect(page).toHaveTitle('Open Keychain 3D | Генератор именных брелоков');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  assertNoBrowserErrors();
});

test('keeps the language flag picker accessible and keyboard navigable', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  const picker = page.locator('.language-picker');
  const trigger = picker.locator('.language-picker-trigger');
  await expect(trigger).toContainText('🇬🇧');
  await expect(trigger).toHaveAttribute('aria-label', 'Language: English');

  await trigger.click();
  const menu = picker.getByRole('listbox', { name: 'Language' });
  await expect(menu.getByRole('option')).toHaveCount(3);
  await expect(menu.locator('[data-language-option="en"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(trigger).toContainText('🇷🇺');
  await expect(trigger).toHaveAttribute('aria-label', 'Язык: Русский');

  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  assertNoBrowserErrors();
});

test('publishes crawler metadata and route-aware canonical URLs', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap: https://open-keychain.com/sitemap.xml');

  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('<loc>https://open-keychain.com/</loc>');

  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://open-keychain.com/',
  );
  expect(
    await page
      .locator('script[type="application/ld+json"]')
      .evaluate((element) => element.textContent),
  ).toContain('WebApplication');
  await selectLocale(page, 'ru');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Создавайте бесплатные/,
  );

  await page.goto('/create');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://open-keychain.com/create',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Design a personalized printable keychain/,
  );
  assertNoBrowserErrors();
});

test('requires explicit analytics consent and remembers the choice', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  const banner = page.locator('.analytics-consent');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'No thanks' }).click();
  await expect(banner).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('open-keychain.analytics-consent'))).toBe(
    'declined',
  );
  assertNoBrowserErrors();
});

test('accepts analytics consent without blocking the primary action', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/');
  await page.locator('.analytics-consent').getByRole('button', { name: 'Allow analytics' }).click();
  await expect(page.locator('.analytics-consent')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('open-keychain.analytics-consent'))).toBe(
    'accepted',
  );
  await page.getByRole('link', { name: 'Start designing' }).first().click();
  await expect(page).toHaveURL(/\/create$/);
  assertNoBrowserErrors();
});

test('loads when analytics module URLs and transport requests are blocked', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.route(/\/src\/infrastructure\/analytics\/|posthog/, (route) => route.abort());
  await page.goto('/create');
  await expect(page.getByRole('main', { name: 'Customizer' })).toBeVisible();
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});

for (const locale of ['en', 'ru', 'uk'] as const) {
  test(`keeps the ${locale.toUpperCase()} landing chrome readable`, async ({ page }) => {
    const assertNoBrowserErrors = watchBrowserErrors(page);

    await page.goto('/');
    await selectLocale(page, locale);
    await expect(page.locator('.configurator-showcase-caption')).toBeVisible();
    await expect(page.locator('.landing-process span').first()).toHaveCSS('font-size', '24px');
    const gap = await page.locator('.configurator-showcase').evaluate((showcase) => {
      const windowBox = showcase.querySelector('.configurator-window')?.getBoundingClientRect();
      const captionBox = showcase
        .querySelector('.configurator-showcase-caption')
        ?.getBoundingClientRect();
      return windowBox && captionBox ? captionBox.top - windowBox.bottom : -1;
    });
    expect(gap).toBeGreaterThanOrEqual(24);
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    assertNoBrowserErrors();
  });
}

for (const width of [760, 761, 1000, 1001]) {
  test(`keeps the landing route usable at the ${width}px layout boundary`, async ({ page }) => {
    const assertNoBrowserErrors = watchBrowserErrors(page);

    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Start designing' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    assertNoBrowserErrors();
  });
}
