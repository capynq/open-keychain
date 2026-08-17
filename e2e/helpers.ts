import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

export type PngDimensions = { width: number; height: number };

/** Validate that a captured PNG is non-empty and has the expected viewport size. */
export const assertPngCapture = async (
  image: Buffer,
  expected: PngDimensions,
): Promise<PngDimensions> => {
  expect(image.byteLength).toBeGreaterThan(1024);
  expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(image.toString('ascii', 12, 16)).toBe('IHDR');

  const dimensions = {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
  expect(dimensions).toEqual(expected);
  const stats = await sharp(image).stats();
  expect(stats.channels.some((channel) => channel.max - channel.min > 8)).toBe(true);
  return dimensions;
};

export const watchBrowserErrors = (page: Page): (() => void) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  return () => expect(errors, errors.join('\n')).toEqual([]);
};

export const waitForLocalFonts = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('900 16px OpenNunito'),
      document.fonts.load('400 16px OpenBree'),
    ]);
    await document.fonts.ready;
  });
};

export const waitForReadyGeometry = async (page: Page): Promise<void> => {
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 15_000 });
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
};

export const prepareForCapture = async (page: Page): Promise<void> => {
  await waitForLocalFonts(page);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.001ms !important;
        caret-color: transparent !important;
      }
    `,
  });
};
