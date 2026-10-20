import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { encodeDesignDocument } from '../src/domain/keychain/design-document';
import { createDesignDocument } from '../src/domain/keychain/model/design-schema';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';
import { waitForReadyGeometry } from './helpers';

const locales = Object.fromEntries(
  ['en', 'ru', 'uk'].map((locale) => [
    locale,
    JSON.parse(readFileSync(`src/infrastructure/i18n/locales/${locale}.json`, 'utf8')),
  ]),
) as Record<'en' | 'ru' | 'uk', Record<string, string>>;
const design = encodeDesignDocument(
  createDesignDocument({
    ...DEFAULT_PARAMS,
    fontId: 'nunito',
    textEdgeFinish: 'round',
    textEdgeMm: 0.6,
  }),
);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    localStorage.setItem('open-keychain.analytics-consent', 'declined'),
  );
});

for (const [width, height] of [
  [768, 1024],
  [844, 390],
  [320, 640],
]) {
  test(`stacked preview keeps Photo and Surface usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/create');
    await waitForReadyGeometry(page);
    const canvas = page.locator('.viewer-surface canvas');
    expect((await canvas.boundingBox())!.height).toBeGreaterThan(100);
    const photo = page.locator('[data-icon-action="preview-photo"]');
    await photo.click();
    const popup = page.getByRole('dialog', { name: 'Photo resolution', exact: true });
    await expect(popup).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`photo-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(photo).toBeFocused();
    await page.locator('.surface-trigger').click();
    await expect(page.getByRole('dialog', { name: 'Preview surface', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('font source tabs have unique relationships and keep keyboard focus inside the chooser', async ({
  page,
}) => {
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await expect(page.getByRole('region', { name: 'Live preview', exact: true })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Preview camera controls', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Template choices', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Font pages', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find a specific font', exact: true }).click();
  const dialog = page.getByTestId('font-chooser-dialog');
  const tabs = dialog.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  const ids = await page
    .locator('[role="tab"], [role="tabpanel"]')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  const selected = dialog.getByRole('tab', { selected: true });
  const panel = dialog.getByRole('tabpanel');
  expect(await panel.getAttribute('id')).toBe(await selected.getAttribute('aria-controls'));
  expect(await panel.getAttribute('aria-labelledby')).toBe(await selected.getAttribute('id'));
});

test('localized recovery stays readable, aligned and keyboard reachable with doubled text', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const locale of ['en', 'ru', 'uk'] as const) {
    const messages = locales[locale];
    await page.goto(`/create?design=${design}&lang=${locale}`);
    await expect(page.locator('main:not(.customizer-boot-frame) .status-pill.ready')).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: messages.simpleFindFont, exact: true }).click();
    const dialog = page.getByTestId('font-chooser-dialog');
    await dialog.getByRole('searchbox').fill('Balsamiq');
    await dialog.getByRole('button', { name: /Balsamiq Sans/ }).click();
    const failure = dialog.locator('[data-recovery-code="text-edge-too-large"]');
    const fix = failure.getByRole('button', { name: messages.recoveryFix, exact: true });
    await expect(fix).toBeVisible();
    expect((await fix.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await fix.click();
    const notice = failure.locator('[data-recovery-notice]');
    await page.addStyleTag({
      content:
        '[data-recovery-notice] * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } [data-recovery-notice] p { margin-bottom: 2em !important; }',
    });
    const disclosure = notice.locator('summary');
    await disclosure.focus();
    expect((await disclosure.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');
    await expect(notice.locator('details')).toHaveAttribute('open', '');
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await expect(dialog.locator('[role="alert"] button, [role="status"] button')).toHaveCount(0);
    const name = dialog.locator('.font-card small').first();
    expect(await name.evaluate((element) => getComputedStyle(element).textOverflow)).not.toBe(
      'ellipsis',
    );
    await page.screenshot({ path: testInfo.outputPath(`recovery-${locale}-large-text.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('unavailable preview recovery remains scrollable at narrow width and enlarged text', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/create?lang=uk');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const surface = page.locator('.viewer-surface');
  const notice = surface.locator('[data-recovery-notice]');
  await expect(notice).toBeVisible();
  await surface.focus();
  await surface.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => surface.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  for (const action of await notice.getByRole('button').all()) {
    await action.focus();
    await expect(action).toBeInViewport();
    const within = await action.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const container = element.closest('.viewer-surface')!.getBoundingClientRect();
      return (
        bounds.left >= container.left &&
        bounds.right <= container.right + 1 &&
        bounds.top >= container.top &&
        bounds.bottom <= container.bottom + 1
      );
    });
    expect(within).toBe(true);
  }
  await expect(notice.getByRole('alert')).toBeVisible();
  await expect(notice.locator('[role="alert"] button')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('preview-unavailable-large-text.png') });
});

test('Photo selection and keyboard focus remain visible in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await page.locator('[data-icon-action="preview-photo"]').click();
  const jpg = page.getByRole('radio', { name: 'JPG', exact: true });
  await page.getByRole('radio', { name: 'PNG', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(jpg).toBeChecked();
  await expect(jpg).toBeFocused();
  const selected = page.locator('.photo-format-option:has(input:checked)');
  const appearance = await selected.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      border: style.borderTopStyle,
      width: parseFloat(style.borderTopWidth),
      weight: Number(style.fontWeight),
      outline: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    };
  });
  expect(appearance.border).toBe('solid');
  expect(appearance.width).toBeGreaterThanOrEqual(2);
  expect(appearance.weight).toBeGreaterThanOrEqual(700);
  expect(appearance.outline).not.toBe('none');
  expect(appearance.outlineWidth).toBeGreaterThanOrEqual(2);
});
