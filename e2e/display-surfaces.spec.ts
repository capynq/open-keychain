import { expect, test } from '@playwright/test';
import sharp from 'sharp';

import { waitForReadyGeometry } from './helpers';

const countBackingPixels = async (image: Buffer): Promise<number> => {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let backingPixels = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > data[i + 1] * 2 && data[i] > data[i + 2] * 2 && data[i] > 70) backingPixels++;
  }
  return backingPixels;
};

for (const surface of ['Wood board', 'Metal board']) {
  test(`${surface} keeps its solid board during camera rotation`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('open-keychain.analytics-consent', 'declined');
    });
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await page.locator('.surface-trigger').click();
    await page
      .getByRole('dialog', { name: 'Preview surface' })
      .getByRole('button', { name: surface })
      .click();
    for (let step = 0; step < 4; step++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const canvas = page.locator('.viewer-surface canvas');
    const above = await canvas.screenshot({ path: testInfo.outputPath('above.png') });
    expect(await countBackingPixels(above)).toBeGreaterThan(100);
    await testInfo.attach('above', {
      body: above,
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'Bottom view', exact: true }).click();
    const image = await canvas.screenshot({ path: testInfo.outputPath('underside.png') });
    const backingPixels = await countBackingPixels(image);
    // The solid board remains between the camera and keychain from underneath.
    expect(backingPixels).toBeLessThan(100);
    await testInfo.attach('underside', { body: image, contentType: 'image/png' });
    await page.getByRole('button', { name: 'Front view', exact: true }).click();
    await canvas.screenshot({ path: testInfo.outputPath('side.png') });
    await page.getByRole('button', { name: 'Home view', exact: true }).click();
    await testInfo.attach('restored', {
      body: await canvas.screenshot({ path: testInfo.outputPath('restored.png') }),
      contentType: 'image/png',
    });
  });
}

test('switching surfaces preserves apparent model size and position at fit and inspection zoom', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    localStorage.setItem('open-keychain.analytics-consent', 'declined'),
  );
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const canvas = page.locator('.viewer-surface canvas');
  const backingBounds = async () => {
    const { data, info } = await sharp(await canvas.screenshot())
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let left = info.width,
      right = -1,
      top = info.height,
      bottom = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] > 70 && data[i] > data[i + 1] * 2 && data[i] > data[i + 2] * 2) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    expect(right).toBeGreaterThan(left);
    return [left, right, top, bottom];
  };
  for (const zoomSteps of [0, 4]) {
    await page.getByRole('button', { name: 'Home view', exact: true }).click();
    for (let step = 0; step < zoomSteps; step++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const baseline = await backingBounds();
    const zoom = await page.locator('.viewer').getAttribute('data-zoom-scale');
    for (const surface of ['Wood board', 'Metal board', 'Reset surface']) {
      await page.locator('.surface-trigger').click();
      await page
        .getByRole('dialog', { name: 'Preview surface' })
        .getByRole('button', { name: surface })
        .click();
      await expect(page.locator('.viewer')).toHaveAttribute('data-zoom-scale', zoom!);
      const bounds = await backingBounds();
      bounds.forEach((value, index) =>
        expect(Math.abs(value - baseline[index])).toBeLessThanOrEqual(1),
      );
    }
  }
});
