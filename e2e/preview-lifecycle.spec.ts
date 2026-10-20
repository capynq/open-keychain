import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

import { assertVisibleModel, waitForReadyGeometry } from './helpers';

const countRedPixels = async (image: Buffer): Promise<number> => {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let redPixels = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] > data[index + 1] * 2 && data[index] > data[index + 2] * 2 && data[index] > 100)
      redPixels++;
  }
  return redPixels;
};

const assertControlledDefaultPixels = async (page: Page): Promise<void> => {
  const image = await page.locator('.viewer-surface canvas').screenshot();
  expect(await countRedPixels(image)).toBeGreaterThan(100);
};

const installDelayedGeometryWorker = async (page: Page) => {
  await page.addInitScript((delayMs: number) => {
    const NativeWorker = window.Worker;
    class DelayedWorker extends NativeWorker {
      override set onmessage(handler: ((event: MessageEvent) => void) | null) {
        super.onmessage = handler
          ? (event) => window.setTimeout(() => handler.call(this, event), delayMs)
          : null;
      }
      override get onmessage(): ((event: MessageEvent) => void) | null {
        return super.onmessage;
      }
    }
    window.Worker = DelayedWorker;
  }, 1_200);
};

const losePreviewContext = async (page: Page) => {
  await expect(page.locator('.viewer-surface canvas')).toHaveCount(1);
  const supported = await page
    .locator('.viewer-surface canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('webgl2');
      const extension = context?.getExtension('WEBGL_lose_context');
      if (!extension) return false;
      extension.loseContext();
      return true;
    });
  expect(supported, 'WEBGL_lose_context must be available for this regression fixture').toBe(true);
};

test.describe('preview lifecycle', () => {
  test('draws actual model pixels after delayed geometry', async ({ page }) => {
    await installDelayedGeometryWorker(page);
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
  });

  test('keeps actual model pixels through reload and navigation', async ({ page }) => {
    await installDelayedGeometryWorker(page);
    await page.goto('/create');
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
    await page.reload();
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
    await page.goto('/');
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
  });

  test('automatically recovers a lost context while preserving pose and surface', async ({
    page,
  }) => {
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.locator('.surface-trigger').click();
    await page
      .getByRole('dialog', { name: 'Preview surface' })
      .getByRole('button', { name: 'Metal board' })
      .click();
    const viewer = page.locator('.viewer');
    const preview = page.locator('.preview-panel');
    const session = Number(await preview.getAttribute('data-renderer-session'));
    const zoom = await viewer.getAttribute('data-zoom-scale');
    await losePreviewContext(page);
    await expect(preview).toHaveAttribute('data-renderer-session', String(session + 1), {
      timeout: 15_000,
    });
    await expect(preview).toHaveAttribute('data-renderer-state', 'ready', { timeout: 15_000 });
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
    await expect(viewer).toHaveAttribute('data-zoom-scale', zoom!);
    await expect(viewer).toHaveAttribute('data-surface', 'metal');
  });

  test('exposes manual retry after a second context loss', async ({ page }) => {
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
    const preview = page.locator('.preview-panel');
    const session = Number(await preview.getAttribute('data-renderer-session'));
    await losePreviewContext(page);
    await expect(preview).toHaveAttribute('data-renderer-session', String(session + 1));
    await expect(preview).toHaveAttribute('data-renderer-state', 'ready', { timeout: 15_000 });
    await assertVisibleModel(page);
    await assertControlledDefaultPixels(page);
    await losePreviewContext(page);
    await expect(preview).toHaveAttribute('data-renderer-state', 'failed', { timeout: 15_000 });
    await expect(page.locator('.status-pill:visible').first()).not.toHaveText('Ready to print');
    await expect(page.locator('[data-icon-action="preview-photo"]')).toBeDisabled();
    const retry = page.locator('.viewer-surface [data-recovery-notice]').getByRole('button', {
      name: 'Try again',
      exact: true,
    });
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await retry.click();
    await waitForReadyGeometry(page);
    await assertVisibleModel(page);
  });
});

test('recovers once when a model draw throws', async ({ page }) => {
  await page.addInitScript(() => {
    type DrawWindow = Window & { failNextModelDraw?: boolean };
    const elements = WebGL2RenderingContext.prototype.drawElements;
    const arrays = WebGL2RenderingContext.prototype.drawArrays;
    const maybeFail = (): void => {
      if ((window as DrawWindow).failNextModelDraw) {
        (window as DrawWindow).failNextModelDraw = false;
        throw new Error('Injected model draw failure');
      }
    };
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      maybeFail();
      elements.apply(this, args);
    };
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      maybeFail();
      arrays.apply(this, args);
    };
  });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const preview = page.locator('.preview-panel');
  const session = Number(await preview.getAttribute('data-renderer-session'));
  await page.evaluate(() => {
    (window as Window & { failNextModelDraw?: boolean }).failNextModelDraw = true;
  });
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(preview).toHaveAttribute('data-renderer-session', String(session + 1));
  await expect(preview).toHaveAttribute('data-renderer-state', 'ready');
  await assertControlledDefaultPixels(page);
});

test('recovers context during an edit without acknowledging the pending model', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type HeldWindow = Window & { releaseGeometry?: () => void };
    const NativeWorker = window.Worker;
    let held = false;
    window.Worker = class extends NativeWorker {
      override set onmessage(handler: ((event: MessageEvent) => void) | null) {
        super.onmessage = handler
          ? (event) => {
              if (event.data.type === 'validation' && !held) {
                held = true;
                (window as HeldWindow).releaseGeometry = () => handler.call(this, event);
              } else handler.call(this, event);
            }
          : null;
      }
      override get onmessage(): ((event: MessageEvent) => void) | null {
        return super.onmessage;
      }
    };
  });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const preview = page.locator('.preview-panel');
  const generation = await preview.getAttribute('data-generation-id');
  const session = Number(await preview.getAttribute('data-renderer-session'));
  await page.getByLabel('Name or text', { exact: true }).fill('JANE');
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as Window & { releaseGeometry?: () => void }).releaseGeometry,
      ),
    )
    .toBe('function');
  await losePreviewContext(page);
  await expect(preview).toHaveAttribute('data-renderer-session', String(session + 1));
  await expect(preview).toHaveAttribute('data-renderer-state', 'ready');
  await expect(preview).toHaveAttribute('data-generation-id', generation!);
  await expect(page.locator('.status-pill:visible').first()).not.toHaveText('Ready to print');
  await expect(page.locator('[data-icon-action="preview-photo"]')).toBeDisabled();
  await page.evaluate(() =>
    (window as Window & { releaseGeometry?: () => void }).releaseGeometry?.(),
  );
  await waitForReadyGeometry(page);
  await expect(preview).not.toHaveAttribute('data-generation-id', generation!);
  await assertControlledDefaultPixels(page);
});
