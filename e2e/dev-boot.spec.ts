import { expect, test } from '@playwright/test';

const customizerRoutes = ['/create', '/create/'] as const;

test('serves the Customizer boot variants only on development Customizer routes', async ({
  page,
}) => {
  for (const route of customizerRoutes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('template[data-customizer-boot]')).toHaveCount(18);
    await expect(page.locator('#boot-customizer .customizer-topbar')).toBeVisible();
    await expect(page.locator('#boot-customizer .controls-panel')).toBeVisible();
    await expect(page.locator('link[data-customizer-boot-style]')).toHaveCount(13);
  }

  const landingResponse = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(landingResponse?.status()).toBe(200);
  await expect(page.locator('template[data-customizer-boot]')).toHaveCount(0);
  await expect(page.locator('#boot-customizer .customizer-topbar')).toHaveCount(0);
});

test('renders the requested locale and template before the React entry loads', async ({
  page,
}, testInfo) => {
  let releaseEntry: (() => void) | undefined;
  const entryHeld = new Promise<void>((resolve) => {
    releaseEntry = resolve;
  });
  await page.route('**/src/main.tsx*', async (route) => {
    await entryHeld;
    await route.continue();
  });

  try {
    const response = await page.goto('/create?template=magnet&lang=ru', {
      waitUntil: 'commit',
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator('template[data-customizer-boot]')).toHaveCount(18);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('link[data-customizer-boot-style]')).toHaveCount(13);
    await expect(
      page.locator('#boot-customizer [data-testid="template-card-magnet"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#boot-customizer')).toBeVisible();

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

    const selectors = [
      'header.customizer-topbar',
      'aside.controls-panel',
      '[data-testid="template-card-nameplate"]',
      '.preview-panel',
      '.preview-heading',
      '.viewer-wrap',
      '.preview-summary',
    ];
    const mobileVariableHeightSelectors = new Set(['aside.controls-panel']);
    const readBoxes = async (root: '#boot-customizer' | '#root') =>
      page.evaluate(
        ({ boxSelectors, selectorRoot }) =>
          Object.fromEntries(
            boxSelectors.map((selector) => {
              const element = document.querySelector(`${selectorRoot} ${selector}`);
              if (!element) throw new Error(`Missing parity selector: ${selector}`);
              const { x, y, width, height } = element.getBoundingClientRect();
              return [selector, { x, y, width, height }];
            }),
          ),
        { boxSelectors: selectors, selectorRoot: root },
      );
    const bootBoxes = await readBoxes('#boot-customizer');
    releaseEntry?.();
    releaseEntry = undefined;
    await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const liveBoxes = await readBoxes('#root');
    for (const selector of selectors) {
      const bootBox = bootBoxes[selector as keyof typeof bootBoxes];
      const liveBox = liveBoxes[selector as keyof typeof liveBoxes];
      expect(Math.abs(bootBox.x - liveBox.x), `${selector} x`).toBeLessThanOrEqual(1);
      expect(Math.abs(bootBox.y - liveBox.y), `${selector} y`).toBeLessThanOrEqual(1);
      expect(Math.abs(bootBox.width - liveBox.width), `${selector} width`).toBeLessThanOrEqual(1);
      if (testInfo.project.name !== 'mobile' || !mobileVariableHeightSelectors.has(selector)) {
        expect(Math.abs(bootBox.height - liveBox.height), `${selector} height`).toBeLessThanOrEqual(
          1,
        );
      }
    }
  } finally {
    releaseEntry?.();
  }
  await expect(page.getByRole('main', { name: 'Customizer' })).toBeVisible();
});

test('handles concurrent cold and repeat Customizer loads without dev boot errors', async ({
  browser,
}) => {
  const errors: string[] = [];
  const badResponses: string[] = [];
  const contexts = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400) {
          badResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      return { context, page };
    }),
  );

  try {
    const responses = await Promise.all(
      contexts.map(({ page }, index) =>
        page.goto(customizerRoutes[index % 2], { waitUntil: 'domcontentloaded' }),
      ),
    );
    for (const response of responses) expect(response?.status()).toBe(200);
    await Promise.all(
      contexts.map(async ({ page }) => {
        await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
        await expect(page.getByRole('main', { name: 'Customizer' })).toBeVisible();
      }),
    );

    const repeatResponses = await Promise.all(
      contexts.map(({ page }, index) =>
        page.goto(customizerRoutes[(index + 1) % 2], { waitUntil: 'domcontentloaded' }),
      ),
    );
    for (const response of repeatResponses) expect(response?.status()).toBe(200);
    await Promise.all(
      contexts.map(({ page }) =>
        expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true'),
      ),
    );
  } finally {
    await Promise.all(contexts.map(({ context }) => context.close()));
  }

  expect(badResponses).toEqual([]);
  expect(errors).toEqual([]);
});
