import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import {
  assertPngCapture,
  prepareForCapture,
  waitForReadyGeometry,
  watchBrowserErrors,
} from './helpers';

const screenshotByProject = {
  'capture-desktop': 'public/showcase/create-desktop.png',
  'capture-mobile': 'public/showcase/create-mobile.png',
} as const;

test('captures the reviewed customizer showcase', async ({ page }, testInfo) => {
  const target = screenshotByProject[testInfo.project.name as keyof typeof screenshotByProject];
  const assertNoBrowserErrors = watchBrowserErrors(page);

  expect(target).toBeDefined();
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await prepareForCapture(page);
  const screenshot = await page.screenshot({ path: target, animations: 'disabled' });
  assertPngCapture(
    screenshot,
    testInfo.project.name === 'capture-mobile'
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
  );
  assertNoBrowserErrors();
});

const templatePreviews = [
  { label: 'Name keychain', file: 'name-keychain' },
  { label: 'Articulated name', file: 'articulated-name' },
  { label: 'Nameplate', file: 'nameplate' },
  { label: 'Plant label', file: 'plant-label' },
] as const;

for (const template of templatePreviews) {
  test(`captures the ${template.label.toLowerCase()} template preview`, async ({
    page,
  }, testInfo) => {
    const suffix = testInfo.project.name === 'capture-mobile' ? 'mobile' : 'desktop';
    const assertNoBrowserErrors = watchBrowserErrors(page);

    await mkdir('public/showcase/templates', { recursive: true });
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await page.locator('.template-grid button').filter({ hasText: template.label }).click();
    await waitForReadyGeometry(page);
    await prepareForCapture(page);
    const viewerCapture = await page.locator('.viewer-wrap').screenshot({ animations: 'disabled' });
    const screenshot = await sharp(viewerCapture)
      .resize({ width: 640, height: 360, fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
    const assetTarget = `public/showcase/templates/${template.file}${suffix === 'mobile' ? '-mobile' : ''}.png`;
    await sharp(screenshot).toFile(assetTarget);
    assertPngCapture(screenshot, { width: 640, height: 360 });
    assertNoBrowserErrors();
  });
}
