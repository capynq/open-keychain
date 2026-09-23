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
      await expect(page).toHaveTitle(
        'Open Keychain 3D | Free 3D printable name-keychain generator',
      );
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
  await expect(page).toHaveURL('/create?lang=en');
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

test('renders the real Customizer frame before React and hands off without a layout jump', async ({
  page,
}) => {
  const path = '/create?template=nameplate&lang=ru';
  let releaseAppEntry: (() => void) | undefined;
  const appEntryHeld = new Promise<void>((resolve) => {
    releaseAppEntry = resolve;
  });
  await page.route('**/assets/app-*.js', async (route) => {
    await appEntryHeld;
    await route.continue();
  });
  await page.goto(path, { waitUntil: 'commit' });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) =>
        link.sheet
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              link.addEventListener('load', () => resolve(), { once: true });
              link.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    );
    await document.fonts.ready;
  });
  await expect(page.locator('head link[data-customizer-boot-style]')).toHaveCount(4);

  const selectors = [
    'header.customizer-topbar',
    'aside.controls-panel',
    '[data-testid="name-settings"]',
    '[data-testid="template-settings"]',
    '.preview-panel',
    '.preview-heading',
    '.viewer-wrap',
    '.preview-summary',
  ];
  const readBoxes = async (root: '#boot-customizer' | '#root') =>
    page.evaluate(
      ({ boxSelectors, selectorRoot }) => {
        const boxes = Object.fromEntries(
          boxSelectors.map((selector) => {
            const element = document.querySelector(`${selectorRoot} ${selector}`);
            if (!element) throw new Error(`Missing layout parity selector: ${selector}`);
            const { x, y, width, height } = element.getBoundingClientRect();
            return [selector, { x, y, width, height }];
          }),
        );
        return boxes;
      },
      { boxSelectors: selectors, selectorRoot: root },
    );
  const readVisibleFontCards = async (root: '#boot-customizer' | '#root') =>
    page.evaluate((selectorRoot) => {
      const panel = document.querySelector(`${selectorRoot} .controls-panel`);
      if (!panel) throw new Error(`Missing controls panel in ${selectorRoot}`);
      const bounds = panel.getBoundingClientRect();
      const visibleTop = Math.max(bounds.top, 0);
      const visibleBottom = Math.min(bounds.bottom, window.innerHeight);
      return [...panel.querySelectorAll<HTMLElement>('.font-card')]
        .map((card) => {
          const { x, y, width, height, top, bottom } = card.getBoundingClientRect();
          return {
            name: card.textContent?.trim(),
            selected: card.getAttribute('aria-pressed'),
            x,
            y,
            width,
            height,
            top,
            bottom,
          };
        })
        .filter((card) => card.top < visibleBottom && card.bottom > visibleTop);
    }, root);

  await expect(page.locator('#boot-customizer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#boot-customizer header.customizer-topbar')).toBeVisible();
  await expect(
    page.locator('#boot-customizer [data-testid="template-card-nameplate"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#root')).not.toHaveAttribute('data-app-ready', 'true');
  const bootBoxes = await readBoxes('#boot-customizer');
  const bootFontCards = await readVisibleFontCards('#boot-customizer');

  releaseAppEntry?.();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await waitForLocalFonts(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(
    page.locator('#root .template-grid [data-testid="template-card-nameplate"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  const liveBoxes = await readBoxes('#root');
  const liveFontCards = await readVisibleFontCards('#root');
  expect(bootFontCards).toEqual(liveFontCards);
  for (const selector of selectors) {
    const bootBox = bootBoxes[selector as keyof typeof bootBoxes];
    const liveBox = liveBoxes[selector as keyof typeof liveBoxes];
    expect(Math.abs(bootBox.x - liveBox.x), `${selector} x`).toBeLessThanOrEqual(1);
    if (selector !== 'aside.controls-panel') {
      expect(Math.abs(bootBox.y - liveBox.y), `${selector} y`).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(bootBox.width - liveBox.width), `${selector} width`).toBeLessThanOrEqual(1);
    if (selector !== 'aside.controls-panel') {
      expect(Math.abs(bootBox.height - liveBox.height), `${selector} height`).toBeLessThanOrEqual(
        1,
      );
    }
  }
});

test('selects known boot URL variants and stays neutral for restored designs', async ({ page }) => {
  await page.route('**/assets/app-*.js', (route) => route.abort());
  const variants = [
    { query: '?template=name-keychain&lang=en', locale: 'en', selected: 'name-keychain' },
    { query: '?template=articulated-name&lang=ru', locale: 'ru', selected: 'articulated-name' },
    { query: '?template=magnet&lang=uk', locale: 'uk', selected: 'magnet' },
    { query: '?template=nameplate&lang=ru', locale: 'ru', selected: 'nameplate' },
    { query: '?template=plant-label&lang=uk', locale: 'uk', selected: 'plant-label' },
    { query: '?template=invalid&lang=en', locale: 'en', selected: 'name-keychain' },
    { query: '?design=shared-state&lang=en', locale: 'en', selected: null },
  ] as const;

  for (const variant of variants) {
    await page.goto(`/create${variant.query}`);
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale);
    await expect(page.locator('#boot-customizer')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#boot-customizer .customizer-topbar')).toBeVisible();
    if (variant.selected) {
      await expect(
        page.locator(`#boot-customizer [data-testid="template-card-${variant.selected}"]`),
      ).toHaveAttribute('aria-pressed', 'true');
      if (variant.selected === 'name-keychain') {
        await expect(
          page.locator('#boot-customizer [data-testid="style-card-contour"]'),
        ).toHaveAttribute('aria-pressed', 'true');
      }
    } else {
      await expect(
        page.locator('#boot-customizer .template-grid [aria-pressed="true"]'),
      ).toHaveCount(0);
      await expect(page.locator('#boot-customizer .preview-summary')).not.toContainText(
        /keychain|nameplate|label|магнит|табличк/i,
      );
      await expect(
        page.locator('#boot-customizer .font-browser [aria-pressed="true"]'),
      ).toHaveCount(0);
    }
  }
});

test('preserves visible Font cards in the taller desktop first viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.setViewportSize({ width: 1440, height: 1080 });
  const path = '/create?template=nameplate&lang=en';
  let releaseAppEntry: (() => void) | undefined;
  const appEntryHeld = new Promise<void>((resolve) => {
    releaseAppEntry = resolve;
  });
  await page.route('**/assets/app-*.js', async (route) => {
    await appEntryHeld;
    await route.continue();
  });
  await page.goto(path, { waitUntil: 'commit' });
  await expect(page.locator('#boot-customizer aside.controls-panel')).toBeVisible();
  const readVisibleFontCards = async (root: '#boot-customizer' | '#root') =>
    page.evaluate((selectorRoot) => {
      const panel = document.querySelector(`${selectorRoot} .controls-panel`);
      if (!panel) throw new Error(`Missing controls panel in ${selectorRoot}`);
      const bounds = panel.getBoundingClientRect();
      const visibleTop = Math.max(bounds.top, 0);
      const visibleBottom = Math.min(bounds.bottom, window.innerHeight);
      return [...panel.querySelectorAll<HTMLElement>('.font-card')]
        .map((card) => {
          const { x, y, width, height, top, bottom } = card.getBoundingClientRect();
          return { text: card.textContent?.trim(), x, y, width, height, top, bottom };
        })
        .filter((card) => card.top < visibleBottom && card.bottom > visibleTop);
    }, root);
  const bootCards = await readVisibleFontCards('#boot-customizer');
  await expect(
    bootCards.length,
    'all six boot-frame Font cards should reach the taller viewport',
  ).toBe(6);
  releaseAppEntry?.();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(await readVisibleFontCards('#root')).toEqual(bootCards);
});

test('keeps root overlays inert until the cold Customizer route commits', async ({ page }) => {
  let releaseChunk: (() => void) | undefined;
  const chunkHeld = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  await page.route('**/assets/CustomizerPage-*.js', async (route) => {
    await chunkHeld;
    await route.continue();
  });

  await page.goto('/create?lang=en');
  await expect(page.locator('#boot-customizer .customizer-topbar')).toBeVisible();
  await expect(page.locator('#root .analytics-consent-accept')).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('#root')))).toBe(false);

  releaseChunk?.();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await page.locator('#root .analytics-consent-accept').focus();
  await expect(page.locator('#root .analytics-consent-accept')).toBeFocused();
});

test('un-inerts root and hides the boot shell after a Customizer chunk error', async ({ page }) => {
  await page.route('**/assets/CustomizerPage-*.js', (route) => route.abort());
  await page.goto('/create?lang=en');
  await expect(page.locator('#root .route-load-error')).toBeVisible();
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#boot-shell')).toBeHidden();
});

test('keeps the current route visible while the next route chunk is pending', async ({ page }) => {
  let releaseChunk: (() => void) | undefined;
  let chunkRequested = false;
  const chunkHeld = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  await page.route('**/assets/CustomizerPage-*.js', async (route) => {
    chunkRequested = true;
    await chunkHeld;
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Start designing' }).first().click();
  await expect.poll(() => chunkRequested).toBe(true);
  await expect(page).toHaveURL('/create?lang=en');
  await expect(page.locator('#root .landing-button-primary')).toBeVisible();
  await expect(page.locator('#root [data-route-skeleton]')).toHaveCount(0);

  releaseChunk?.();
  await expect(page.getByRole('main', { name: 'Customizer' })).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
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
  await page.locator('.landing-template-card').last().scrollIntoViewIfNeeded();
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

  expect(images.every((image) => image.src.includes('/showcase/v1/templates/'))).toBe(true);
  expect(images.every((image) => image.width > 0 && image.height > 0)).toBe(true);
  const expectedHeroAsset =
    testInfo.project.name === 'mobile-2x'
      ? 'create-mobile-780'
      : testInfo.project.name === 'mobile'
        ? 'create-mobile-390'
        : 'create-desktop-720';
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
  expect(heroImageState.width).toBeGreaterThan(heroImageState.renderedWidth);
  expect(heroImageState.height).toBeGreaterThan(heroImageState.renderedHeight);
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute('fetchpriority', 'high');
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute('loading', 'eager');
  await expect(page.locator(activeHeroImageSelector)).toHaveAttribute(
    'sizes',
    '(max-width: 760px) calc(100vw - 50px), 50vw',
  );
  await expect(page.locator('.configurator-window source').first()).toHaveAttribute(
    'srcset',
    /create-mobile-780\.avif 780w/,
  );
  await expect(page.locator('.configurator-window source').nth(1)).toHaveAttribute(
    'srcset',
    /create-mobile-390\.avif 390w, \/showcase\/v1\/create-mobile-490\.avif 490w/,
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
  await waitForImageToLoad(page.locator(activeHeroImageSelector));
  const expectedHeroAsset =
    testInfo.project.name === 'mobile-2x' ? 'create-mobile-780' : 'create-mobile-390';
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
  expect(imageState.width).toBeGreaterThan(imageState.renderedWidth);
  expect(imageState.height).toBeGreaterThan(imageState.renderedHeight);
  expect(
    await page.locator(activeHeroImageSelector).evaluate((element) => {
      const image = element as HTMLImageElement;
      return image.currentSrc.includes('/showcase/v1/create-mobile-');
    }),
  ).toBe(true);
  assertNoBrowserErrors();
});

test('renders an unknown path as a noindex not-found page', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/not-a-route');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
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
  await expect(page).toHaveTitle('Open Keychain 3D | Генератор брелоков для 3D-печати');
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
  const landingJsonLd = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  ) as { '@graph'?: Array<Record<string, unknown>> };
  expect(landingJsonLd['@graph']?.some((entry) => entry['@type'] === 'WebApplication')).toBe(false);
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
  await expect(page).toHaveURL('/create?lang=en');
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
