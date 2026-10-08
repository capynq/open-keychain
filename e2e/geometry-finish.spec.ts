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
  await expect(
    finishSettings.getByRole('heading', { name: 'Text edge finish', exact: true }),
  ).toBeVisible();
  await expect(
    finishSettings.getByRole('heading', { name: 'Backing edge finish', exact: true }),
  ).toBeVisible();
  const backing = finishSettings.getByRole('radiogroup', { name: 'Backing profile', exact: true });
  await expect(backing).toBeVisible();
  await waitForReadyGeometry(page);
  await backing.getByRole('radio', { name: 'Chamfered', exact: true }).check();
  await waitForReadyGeometry(page);
  const baseTop = page.getByLabel('Backing top edge');
  const baseBottom = page.getByLabel('Backing bottom edge');
  await expect(baseTop).toBeVisible();
  await expect(baseBottom).toBeVisible();
  const text = finishSettings.getByRole('radiogroup', { name: 'Text profile', exact: true });
  await expect(text.getByRole('radio', { name: 'Sharp', exact: true })).toBeChecked();
  await waitForReadyGeometry(page);
  await text.getByRole('radio', { name: 'Rounded', exact: true }).check();
  await waitForReadyGeometry(page);
  await expect(backing.getByRole('radio', { name: 'Chamfered', exact: true })).toBeChecked();
  const amount = page.getByLabel('Edge amount', { exact: true });
  await expect(amount).toHaveAttribute('step', '0.2');
  await expect(amount).toHaveValue('0.2');
  const maximum = Number(await amount.getAttribute('max'));
  expect(maximum).toBeGreaterThanOrEqual(0.2);
  await amount.fill(String(maximum));
  await waitForReadyGeometry(page);
  await baseTop.fill((await baseTop.getAttribute('max')) ?? '0.2');
  await waitForReadyGeometry(page);
  await expect(text.getByRole('radio', { name: 'Rounded', exact: true })).toBeChecked();
  await expect(baseBottom).toHaveValue('0.2');
  await backing.getByRole('radio', { name: 'Rounded', exact: true }).check();
  await waitForReadyGeometry(page);
  await expect(text.getByRole('radio', { name: 'Rounded', exact: true })).toBeChecked();
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

  await text.getByRole('radio', { name: 'Sharp', exact: true }).check();
  await waitForReadyGeometry(page);
  await expect(amount).toHaveCount(0);
  await text.getByRole('radio', { name: 'Chamfered', exact: true }).check();
  await waitForReadyGeometry(page);
  await expect(amount).toHaveValue('0.2');
  await assertVisibleModel(page);

  const containment = await finishSettings.evaluate((element) => {
    const parent = element.closest('.controls-panel') ?? element.parentElement;
    if (!parent) return { contained: false, overflowCount: 1, overflowDetails: ['missing parent'] };
    const parentRect = parent.getBoundingClientRect();
    const children = [...element.querySelectorAll('label, input, select, svg, p')];
    const overflow = children.filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1;
    });
    return {
      contained: overflow.length === 0,
      overflowCount: overflow.length,
      overflowDetails: overflow.map((child) => ({
        tag: child.tagName,
        text: child.textContent?.trim(),
        left: child.getBoundingClientRect().left,
        right: child.getBoundingClientRect().right,
        parentLeft: parentRect.left,
        parentRight: parentRect.right,
      })),
    };
  });
  expect(containment, `geometry finish controls overflowed: ${containment.overflowCount}`).toEqual({
    contained: true,
    overflowCount: 0,
    overflowDetails: [],
  });

  await prepareForCapture(page);
  await finishSettings.screenshot({ path: testInfo.outputPath('geometry-finish.png') });

  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(
    finishSettings.getByRole('radiogroup', { name: 'Backing profile', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/unavailable for articulated/i)).toBeVisible();
  await expect(text).toBeVisible();
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});
