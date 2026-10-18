import { expect, test } from '@playwright/test';

import { decodeDesignDocument } from '../src/domain/keychain/design-document';
import { designParams } from '../src/domain/keychain/model/design-schema';
import { waitForReadyGeometry } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { sharedDesign?: ShareData }).sharedDesign = data;
      },
    });
  });
  await page.goto('/create');
  await waitForReadyGeometry(page);
});

test('Photo overlays without resizing, clips no actions, and restores keyboard focus', async ({
  page,
}, testInfo) => {
  const trigger = page.getByRole('button', { name: 'Photo', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  const viewer = page.locator('.viewer');
  const before = await viewer.boundingBox();
  const canvasBefore = await page.locator('.viewer-surface canvas').boundingBox();
  await trigger.focus();
  await trigger.press('Enter');
  const popup = page.getByRole('dialog', { name: 'Photo resolution' });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('radio', { name: 'PNG', exact: true })).toBeFocused();
  expect(await viewer.boundingBox()).toEqual(before);
  expect(await page.locator('.viewer-surface canvas').boundingBox()).toEqual(canvasBefore);
  expect(await popup.evaluate((element) => element.closest('.viewer'))).toBeNull();
  const bounds = await popup.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(7);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 7);
  const formatBounds = await popup.locator('.photo-format-options').boundingBox();
  const resolutionBounds = await popup.locator('.photo-resolution-choices').boundingBox();
  expect(formatBounds!.x).toBeCloseTo(resolutionBounds!.x, 0);
  expect(formatBounds!.width).toBeCloseTo(resolutionBounds!.width, 0);
  const segments = await popup.locator('.photo-format-option').all();
  expect((await segments[0]!.boundingBox())!.width).toBeCloseTo(
    (await segments[1]!.boundingBox())!.width,
    0,
  );
  await page.screenshot({ path: testInfo.outputPath('photo-popup.png') });
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press('Space');
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: /4096 px/ }).focus();
  await page.keyboard.press('Tab');
  await expect(popup).toBeHidden();
  await expect(page.locator('.surface-trigger')).toBeFocused();
  await page.locator('.surface-trigger').click();
  await expect(popup).toBeHidden();
  const surfaces = page.getByRole('dialog', { name: 'Preview surface' });
  await expect(surfaces).toBeVisible();
  await surfaces.getByRole('button', { name: 'Wood board', exact: true }).click();
  await expect(surfaces).toBeHidden();
  await expect(viewer).toHaveAttribute('data-surface', 'wood');
  await page.locator('.surface-trigger').click();
  await expect(surfaces.getByRole('button', { name: 'Wood board', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.surface-trigger')).toBeFocused();
});

test('Share offers encoded social links and native sharing without changing layout', async ({
  page,
}, testInfo) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { sharedDesign?: ShareData }).sharedDesign = data;
      },
    });
  });
  const trigger = page.getByRole('button', { name: 'Share', exact: true });
  const before = await page.locator('.viewer').boundingBox();
  await trigger.click();
  const popup = page.getByRole('dialog', { name: 'Share', exact: true });
  await expect(popup).toBeVisible();
  expect(await page.locator('.viewer').boundingBox()).toEqual(before);
  // Short share labels should not inherit the wider Photo resolution panel.
  expect((await popup.boundingBox())!.width).toBeLessThan(270);
  const brandColors: Record<string, string> = {
    Telegram: 'rgb(38, 165, 228)',
    WhatsApp: 'rgb(37, 211, 102)',
    Facebook: 'rgb(8, 102, 255)',
    X: 'rgb(0, 0, 0)',
  };
  for (const [name, host, parameter] of [
    ['Telegram', 't.me', 'url'],
    ['WhatsApp', 'wa.me', 'text'],
    ['Facebook', 'www.facebook.com', 'u'],
    ['X', 'twitter.com', 'url'],
  ]) {
    const link = popup.getByRole('link', { name, exact: true });
    const url = new URL((await link.getAttribute('href'))!);
    expect(url.hostname).toBe(host);
    expect(url.searchParams.get(parameter)).toContain('design=');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link.locator('[data-social-brand]')).toHaveCSS('color', brandColors[name]);
  }
  await page.screenshot({ path: testInfo.outputPath('share-popup.png') });
  await popup.getByRole('button', { name: 'Share via device…' }).click();
  await expect(popup).toBeHidden();
  const shared = await page.evaluate(
    () => (window as Window & { sharedDesign?: ShareData }).sharedDesign,
  );
  expect(shared?.url).toContain('design=');
});

test('Share cancellation is neutral and clipboard failure offers a selectable link', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Cancelled', 'AbortError');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('blocked');
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Share', exact: true });
  await popup.getByRole('button', { name: 'Share via device…' }).click();
  await expect(popup).toBeVisible();
  await expect(popup.getByText('Could not open sharing. Copy the link or try again.')).toHaveCount(
    0,
  );
  await popup.getByRole('button', { name: 'Copy link', exact: true }).click();
  const manual = popup.getByRole('textbox', { name: 'Copy this design link:' });
  await expect(manual).toBeVisible();
  await expect(manual).toHaveValue(/design=/);
  await manual.focus();
  expect(
    await manual.evaluate(
      (element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!,
    ),
  ).toBe((await manual.inputValue()).length);
});

test('localized popups remain usable at 320px and doubled text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const locale of ['en', 'ru', 'uk']) {
    await page.goto(`/create?lang=${locale}`);
    await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('.status-pill')).toHaveClass(/\bready\b/);
    await expect(page.locator('.viewer-surface canvas')).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    for (const action of ['preview-photo', 'share']) {
      const trigger = page.locator(`[data-icon-action="${action}"]`);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const popup = page.locator('[data-anchored-popover]');
      await expect(popup).toBeVisible();
      await expect
        .poll(async () => {
          const bounds = await popup.boundingBox();
          return (
            !!bounds &&
            bounds.x >= 7 &&
            bounds.x + bounds.width <= 313 &&
            bounds.y >= 7 &&
            bounds.y + bounds.height <= 633
          );
        })
        .toBe(true);
      expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      if (action === 'preview-photo') {
        for (const format of await popup.getByText('PNG', { exact: true }).all()) {
          expect(
            await format.evaluate((element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              return range.getClientRects().length;
            }),
          ).toBe(1);
        }
      }
      const last = popup.locator('button, a').last();
      await last.focus();
      await expect(last).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`${locale}-${action}-320-2x.png`) });
      await page.keyboard.press('Escape');
      await expect(popup).toBeHidden();
    }
  }
});

test('successful copying closes Share and later design edits do not reopen it', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  const trigger = page.getByRole('button', { name: 'Share', exact: true });
  await trigger.click();
  const popup = page.getByRole('dialog', { name: 'Share', exact: true });
  await popup.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(popup).toBeHidden();
  await page.getByRole('textbox', { name: 'Name or text', exact: true }).fill('OLIVER');
  await waitForReadyGeometry(page);
  await expect(popup).toBeHidden();
  await trigger.click();
  await expect(popup).toBeVisible();
  const link = popup.getByRole('link', { name: 'Telegram', exact: true });
  const composer = new URL((await link.getAttribute('href'))!);
  const designUrl = new URL(composer.searchParams.get('url')!);
  const design = decodeDesignDocument(designUrl.searchParams.get('design')!);
  expect(design && designParams(design).text).toBe('OLIVER');
});

test('pointer popovers animate reversibly while keyboard and reduced motion stay immediate', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const trigger = page.getByRole('button', { name: 'Photo', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const popup = page.locator('[data-anchored-popover][data-state="open"]');
  await expect(popup).toHaveAttribute('data-motion', 'animated');
  const panel = popup.locator(':scope > div');
  await expect(panel).toHaveCSS('transition-duration', '0.2s');
  const viewerBounds = await page.locator('.viewer').boundingBox();
  await trigger.click();
  const closing = page.locator('[data-anchored-popover][data-state="closed"]');
  await expect(closing).toHaveAttribute('inert', '');
  await expect(closing).toHaveCSS('pointer-events', 'none');
  await trigger.click();
  await expect(popup).toHaveCount(1);
  await expect(panel).toHaveCSS('opacity', '1');
  expect(await page.locator('.viewer').boundingBox()).toEqual(viewerBounds);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(popup).toHaveAttribute('data-motion', 'instant');
  await expect(panel).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(popup).toHaveAttribute('data-motion', 'animated');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Photo resolution' })).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await expect(popup).toHaveAttribute('data-motion', 'instant');
  await expect(panel).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(popup).toHaveAttribute('data-motion', 'instant');
  await expect(panel).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});
