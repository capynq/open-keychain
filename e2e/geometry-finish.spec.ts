import { expect, test } from '@playwright/test';

import {
  assertVisibleModel,
  prepareForCapture,
  waitForReadyGeometry,
  watchBrowserErrors,
} from './helpers';

test('keeps geometry finish controls contained and printable across viewports', async ({
  page,
}, testInfo) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);

  await page.goto('/create');
  await page.getByLabel('Name or text').fill('CAPSULE');
  await page.getByRole('button', { name: 'Capsule' }).click();

  const finishSettings = page.getByTestId('geometry-finish-settings');
  await expect(finishSettings).toBeVisible();
  await expect(finishSettings.getByRole('heading', { name: 'Edge finish' })).toBeVisible();
  await expect(finishSettings.getByText('Before you print', { exact: true })).toHaveCount(0);
  const edgeStyle = page.getByRole('radio', { name: 'Sharp' });
  await expect(edgeStyle).toBeChecked();
  await page.getByRole('radio', { name: 'Rounded' }).check();
  await expect(page.getByLabel('Backing top edge')).toHaveValue('0.6');
  await expect(page.getByLabel('Backing bottom edge')).toHaveValue('0.4');
  await expect(page.getByLabel('Backing top edge')).toHaveAttribute('step', '0.2');
  const diagramOutline = finishSettings.locator('.geometry-finish-diagram-large path').first();
  const roundedOutlineBefore = await diagramOutline.getAttribute('d');
  await page.getByLabel('Backing top edge').fill('0.4');
  await page.getByLabel('Backing bottom edge').fill('0.4');
  await expect(page.getByLabel('Backing top edge')).toHaveValue('0.4');
  await expect(page.getByLabel('Backing bottom edge')).toHaveValue('0.4');
  await expect(diagramOutline).not.toHaveAttribute('d', roundedOutlineBefore ?? '');
  await waitForReadyGeometry(page);
  await assertVisibleModel(page);

  const viewerSurface = page.locator('.viewer-surface');
  const viewerSurfaceBox = await viewerSurface.boundingBox();
  expect(viewerSurfaceBox).toBeTruthy();
  await page.mouse.move(
    viewerSurfaceBox!.x + viewerSurfaceBox!.width * 0.5,
    viewerSurfaceBox!.y + viewerSurfaceBox!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    viewerSurfaceBox!.x + viewerSurfaceBox!.width * 0.56,
    viewerSurfaceBox!.y + viewerSurfaceBox!.height * 0.46,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.locator('.viewer')).toHaveAttribute('data-view', 'custom');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const zoomBeforeEdit = await page.locator('.viewer').getAttribute('data-zoom-scale');
  await page.getByLabel('Name or text').fill('CAP');
  await waitForReadyGeometry(page);
  await expect(page.locator('.viewer')).toHaveAttribute('data-view', 'custom');
  await expect(page.locator('.viewer')).toHaveAttribute('data-zoom-scale', zoomBeforeEdit ?? '');

  await page.getByRole('radio', { name: 'Chamfered' }).check();
  await waitForReadyGeometry(page);
  await assertVisibleModel(page);

  const containment = await finishSettings.evaluate((element) => {
    const parent = element.closest('.controls-panel') ?? element.parentElement;
    if (!parent) return { contained: false, overflow: true };
    const parentRect = parent.getBoundingClientRect();
    const children = [...element.querySelectorAll('label, input, select, svg, p')];
    const overflow = children.filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1;
    });
    return { contained: overflow.length === 0, overflow: overflow.length };
  });
  expect(containment, `geometry finish controls overflowed: ${containment.overflow}`).toEqual({
    contained: true,
    overflow: 0,
  });

  await prepareForCapture(page);
  await finishSettings.screenshot({ path: testInfo.outputPath('geometry-finish.png') });

  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('radio', { name: 'Sharp' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Edge finish' })).toBeHidden();
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});
