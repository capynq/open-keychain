import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { decodeDesignDocument, encodeDesignDocument } from '../src/domain/keychain/design-document';
import { designParams, createDesignDocument } from '../src/domain/keychain/model/design-schema';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';
import { waitForReadyGeometry } from './helpers';

const locales = Object.fromEntries(
  ['en', 'ru', 'uk'].map((locale) => [
    locale,
    JSON.parse(readFileSync(`src/infrastructure/i18n/locales/${locale}.json`, 'utf8')),
  ]),
) as Record<'en' | 'ru' | 'uk', Record<string, string>>;

const appearance = { version: 1 as const, base: '#123456', relief: '#fffaaa' };
const initial = {
  ...DEFAULT_PARAMS,
  fontId: 'nunito',
  textEdgeFinish: 'round' as const,
  textEdgeMm: 0.6,
};
const path =
  '?' +
  new URLSearchParams({
    design: encodeDesignDocument(createDesignDocument(initial, appearance)),
  }).toString();

const failFontChange = async (
  page: Page,
  locale: 'en' | 'ru' | 'uk' = 'en',
  closeChooser = true,
) => {
  const messages = locales[locale];
  await page.goto(`/create${path}&lang=${locale}`);
  await expect(page.locator('main:not(.customizer-boot-frame) .status-pill.ready')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
  await page.getByRole('button', { name: messages.simpleFindFont, exact: true }).click();
  const chooser = page.getByTestId('font-chooser-dialog');
  await chooser.getByRole('searchbox', { name: messages.fontSearch }).fill('Balsamiq');
  await chooser.getByRole('button', { name: /Balsamiq Sans/ }).click();
  await expect(chooser.locator('[data-recovery-code="text-edge-too-large"]')).toBeVisible();
  if (closeChooser) {
    await chooser.getByRole('button', { name: messages.close, exact: true }).click();
    await expect(chooser).toBeHidden();
  }
  const failure = page.locator('[data-recovery-code="text-edge-too-large"]');
  await expect(failure).toBeVisible();
  return { failure, messages, chooser };
};

const shared = async (page: Page) => {
  await page.locator('[data-icon-action="share"]').click();
  const href = await page.getByRole('link', { name: 'Telegram', exact: true }).getAttribute('href');
  const url = new URL(new URL(href!).searchParams.get('url')!);
  const document = decodeDesignDocument(url.searchParams.get('design')!);
  expect(document).toBeDefined();
  await page.keyboard.press('Escape');
  return { params: designParams(document!), appearance: document!.appearanceOverrides };
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    localStorage.setItem('open-keychain.analytics-consent', 'declined'),
  );
});

for (const repair of ['smaller', 'sharp'] as const) {
  test(`keeps the requested font with a validated ${repair} edge and supports Undo`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const { failure, chooser } = await failFontChange(page, 'en', false);
    await failure.getByRole('button', { name: 'Fix this', exact: true }).click();
    const popup = chooser;
    const action = popup.getByRole('button', {
      name:
        repair === 'smaller'
          ? 'Apply Balsamiq Sans with a 0.2 mm edge'
          : 'Apply Balsamiq Sans with sharp edges',
      exact: true,
    });
    await expect(action).toBeEnabled({ timeout: 30_000 });
    await page.screenshot({ path: testInfo.outputPath(`recovery-${repair}.png`) });
    await action.click();
    await expect(chooser).toBeHidden();
    await waitForReadyGeometry(page);
    const result = await shared(page);
    expect(result.params).toMatchObject({
      fontId: 'balsamiq-sans',
      text: initial.text,
      templateId: initial.templateId,
      styleId: initial.styleId,
      textEdgeFinish: repair === 'smaller' ? 'round' : 'sharp',
    });
    expect(result.params.textEdgeMm).toBeCloseTo(repair === 'smaller' ? 0.2 : 0);
    expect(result.appearance).toEqual(appearance);
    await page.getByRole('button', { name: 'Undo fix', exact: true }).click();
    await waitForReadyGeometry(page);
    expect((await shared(page)).params).toMatchObject({
      fontId: 'nunito',
      textEdgeFinish: 'round',
    });
  });
}

test('closing recovery terminates background work and leaves normal edits usable', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let count = 0;
    (window as Window & { recoveryTerminated?: boolean }).recoveryTerminated = false;
    window.Worker = class extends NativeWorker {
      private readonly background = count++ > 0;
      override postMessage(message: unknown, transfer: Transferable[]): void;
      override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
      override postMessage(
        message: unknown,
        options?: Transferable[] | StructuredSerializeOptions,
      ): void {
        if (this.background && (message as { type?: string }).type === 'validate') return;
        if (Array.isArray(options)) super.postMessage(message, options);
        else super.postMessage(message, options);
      }
      override terminate(): void {
        if (this.background)
          (window as Window & { recoveryTerminated?: boolean }).recoveryTerminated = true;
        super.terminate();
      }
    };
  });
  const { failure } = await failFontChange(page);
  const trigger = failure.getByRole('button', { name: 'Fix this' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Ways to fix this' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as Window & { recoveryTerminated?: boolean }).recoveryTerminated,
    ),
  ).toBe(true);
  await page.getByLabel('Name or text', { exact: true }).fill('JANE');
  await waitForReadyGeometry(page);
  expect((await shared(page)).params.text).toBe('JANE');
});

test('recovery stays localized and contained at 320px with doubled text', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const locale of ['en', 'ru', 'uk'] as const) {
    const { failure, messages } = await failFontChange(page, locale);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const trigger = failure.getByRole('button', { name: messages.recoveryFix, exact: true });
    await trigger.click();
    const popup = page.getByRole('dialog', { name: messages.recoveryOptions, exact: true });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button').first()).toBeEnabled({ timeout: 30_000 });
    const bounds = await popup.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(7);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(313);
    expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(await popup.innerText()).not.toMatch(/recovery\.|\{(?:font|amount)\}/);
    await page.screenshot({ path: testInfo.outputPath(`recovery-${locale}-320.png`) });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('photo encoding failure offers a smaller export and retry succeeds', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let fail = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (fail) {
        fail = false;
        callback(null);
      } else original.call(this, callback, type, quality);
    };
  });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await page.locator('[data-icon-action="preview-photo"]').click();
  const popup = page.getByRole('dialog', { name: locales.en.photoResolution, exact: true });
  await popup.getByRole('button', { name: /2048/ }).click();
  const notice = popup.locator('[data-recovery-notice]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(locales.en.recoveryRetry);
  const download = page.waitForEvent('download');
  await notice.getByRole('button', { name: /1024/ }).click();
  expect((await download).suggestedFilename()).toContain('1024');
  await expect(popup).toBeHidden();
});

test('preview initialization can be retried without losing the design', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let blocked = true;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (blocked && String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
    (window as Window & { unblockPreview?: () => void }).unblockPreview = () => {
      blocked = false;
    };
  });
  await page.goto(`/create${path}`);
  const notice = page.locator('.viewer-surface [data-recovery-notice]');
  await expect(notice).toBeVisible();
  await page.evaluate(() =>
    (window as Window & { unblockPreview?: () => void }).unblockPreview?.(),
  );
  await notice.getByRole('button', { name: locales.en.recoveryRetry, exact: true }).click();
  await waitForReadyGeometry(page);
  expect((await shared(page)).params).toMatchObject({ text: initial.text, fontId: initial.fontId });
});
