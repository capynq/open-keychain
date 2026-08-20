import { expect, test } from '@playwright/test';
import { SEO_PAGE_MANIFEST } from '../src/infrastructure/seo/catalog';

test('serves every SEO page as crawlable localized HTML', async ({ page }) => {
  for (const entry of SEO_PAGE_MANIFEST) {
    const response = await page.request.get(entry.path);
    expect(response.ok(), entry.path).toBe(true);
    expect(response.headers()['content-type']).toContain('text/html');
    const html = await response.text();
    expect(html, entry.path).toContain(`<html lang="${entry.locale}"`);
    expect(html, entry.path).toContain('meta name="robots" content="index,follow"');
    expect(html, entry.path).toContain(
      `rel="canonical" href="https://open-keychain.com${entry.path}"`,
    );
    expect(html, entry.path).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
    expect(html, entry.path).toContain('application/ld+json');
    expect(html, entry.path).toContain('hreflang="x-default"');
  }
});

test('renders a localized template page without the application bundle', async ({ page }) => {
  await page.goto('/uk/templates/name-keychain/');
  await expect(page).toHaveTitle(/іменних брелоків/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('іменний брелок');
  await expect(page.locator('script[type="module"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Створити брелок/ })).toHaveAttribute(
    'href',
    '/create?template=name-keychain&lang=uk',
  );
});

test('keeps static-page analytics consent-gated and coarse', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/capture/')) analyticsRequests.push(request.url());
  });
  await page.goto('/templates/name-keychain/');
  await expect(page.locator('[data-analytics-consent]')).toBeVisible();
  expect(analyticsRequests).toEqual([]);
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect(page.locator('[data-analytics-consent]')).toBeHidden();
  expect(analyticsRequests).toEqual([]);
  const analyticsScript = page.locator('script[src="/seo-analytics.js"]');
  await expect(analyticsScript).toHaveAttribute('data-page-type', 'template');
  await expect(analyticsScript).toHaveAttribute('data-page-id', 'name-keychain');
});

test('keeps interactive app shells out of the index', async ({ page }) => {
  for (const route of ['/create', '/profile']) {
    const response = await page.request.get(route);
    expect(response.ok(), route).toBe(true);
    expect(await response.text(), route).toContain('meta name="robots" content="noindex,follow"');
  }
});

test('passes localized template links into the interactive customizer', async ({ page }) => {
  await page.goto('/create?template=plant-label&lang=ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByTestId('template-card-plant-label')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
