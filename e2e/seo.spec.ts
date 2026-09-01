import { expect, test } from '@playwright/test';
import { SEO_PAGE_MANIFEST } from '../src/infrastructure/seo/catalog';
import { selectLocale } from './helpers';

test('renders every localized SEO route through the React app', async ({ page }) => {
  for (const entry of SEO_PAGE_MANIFEST) {
    await page.goto(entry.path);
    await expect(page.locator('html')).toHaveAttribute('lang', entry.locale);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://open-keychain.com${entry.path}`,
    );
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  }
});

test('renders a localized template page with hydrated navigation', async ({ page }) => {
  await page.goto('/uk/templates/name-keychain/');
  await expect(page).toHaveTitle('Open Keychain 3D | Іменний брелок для 3D-друку');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('іменний брелок');
  await expect(page.getByRole('link', { name: /Створити брелок/ })).toHaveAttribute(
    'href',
    '/create?template=name-keychain&lang=uk',
  );
});

test('keeps the localized language when an SEO CTA opens the customizer', async ({ page }) => {
  await page.goto('/ru/templates/name-keychain/');
  await page.getByRole('link', { name: /Создать брелок/ }).click();
  await expect(page).toHaveURL('/create?template=name-keychain&lang=ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('button', { name: /Экспорт/ })).toBeVisible();
});

test('keeps the workflow link anchored on localized SEO home pages', async ({ page }) => {
  await page.goto('/uk/');
  await page.getByRole('link', { name: 'Як це працює' }).click();
  await expect(page).toHaveURL('/uk/#how-it-works');
  await expect(page.locator('#how-it-works')).toBeVisible();
  const headerBottom = await page
    .locator('.landing-topbar')
    .evaluate((element) => element.getBoundingClientRect().bottom);
  const targetTop = await page
    .locator('#how-it-works')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(targetTop).toBeGreaterThanOrEqual(headerBottom - 1);
});

test('keeps privacy and unknown routes noindex', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/route-that-does-not-exist');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('publishes localized metadata for indexable customizer URLs', async ({ page }) => {
  await page.goto('/create?template=nameplate&lang=ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://open-keychain.com/create?template=nameplate&lang=ru',
  );
  await expect(page).toHaveTitle('Open Keychain 3D | Генератор табличек с экспортом STL');
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(jsonLd ?? '{}')).toMatchObject({
    '@type': 'WebApplication',
    inLanguage: 'ru',
    url: 'https://open-keychain.com/create?template=nameplate&lang=ru',
  });
  await page.goto('/create?lang=ru&template=nameplate');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
});

test('uses route artwork for social previews', async ({ page }) => {
  await page.goto('/uk/templates/nameplate/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://open-keychain.com/showcase/templates/nameplate.png',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    'https://open-keychain.com/showcase/templates/nameplate.png',
  );

  await page.goto('/ru/guides/stl-vs-3mf/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://open-keychain.com/showcase/prints/example_1-en.png',
  );
});

test('uses the shared landing shell on SEO pages', async ({ page }) => {
  await page.goto('/ru/templates/nameplate/');
  await expect(page.locator('.landing-topbar')).toBeVisible();
  await expect(page.locator('.landing-footer')).toBeVisible();
  await expect(page.locator('.landing-header-cta')).toHaveAttribute('href', '/create?lang=ru');
  await expect(page.locator('.landing-footer a[href="/privacy"]')).toBeVisible();
});

test('keeps localized SEO home pages on the complete landing content path', async ({ page }) => {
  await page.goto('/ru/');
  await expect(page.locator('.configurator-showcase')).toBeVisible();
  await expect(page.locator('.landing-products')).toBeVisible();
  await expect(page.locator('.landing-run')).toBeVisible();
  await expect(page.locator('.landing-faq')).toBeVisible();
  await expect(page.locator('.landing-trust')).toBeVisible();
});

test('uses the shared language picker and preserves SEO route context', async ({ page }) => {
  await page.goto('/ru/templates/nameplate/');
  await expect(page.locator('.language-picker-trigger')).toContainText('🇷🇺');
  await selectLocale(page, 'uk');
  await expect(page).toHaveURL('/uk/templates/nameplate/');
  await expect(page.locator('.language-picker-trigger')).toContainText('🇺🇦');
});

test('preserves landing locale on generic customizer CTAs', async ({ page }) => {
  await page.goto('/');
  await selectLocale(page, 'ru');
  await page.locator('.landing-header-cta').click();
  await expect(page).toHaveURL('/create?lang=ru');
});

test('preserves locale when opening privacy from an SEO footer', async ({ page }) => {
  await page.goto('/ru/templates/nameplate/');
  await selectLocale(page, 'uk');
  await page.locator('.landing-footer a[href="/privacy"]').click();
  await expect(page).toHaveURL('/privacy');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('конфіденційність');
});

test('keeps SEO mobile navigation compact in every locale', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ['/ru/', '/uk/']) {
    await page.goto(path);
    const guidesLink = page.locator('.landing-nav a').nth(1);
    await expect
      .poll(() => guidesLink.evaluate((element) => element.getClientRects().length))
      .toBe(1);
  }
});
