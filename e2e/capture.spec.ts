import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import {
  assertPngCapture,
  assertVisibleModel,
  prepareForCapture,
  waitForReadyGeometry,
  watchBrowserErrors,
} from './helpers';

const screenshotByProject = {
  'capture-desktop': 'public/showcase/create-desktop.png',
  'capture-mobile': 'public/showcase/create-mobile.png',
  'capture-mobile-2x': 'public/showcase/create-mobile@2x.png',
} as const;

test('captures the reviewed customizer showcase', async ({ page }, testInfo) => {
  const target = screenshotByProject[testInfo.project.name as keyof typeof screenshotByProject];
  const assertNoBrowserErrors = watchBrowserErrors(page);

  expect(target).toBeDefined();
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await prepareForCapture(page);
  await assertVisibleModel(page);
  const screenshot = await page.screenshot({ path: target, animations: 'disabled' });
  await assertPngCapture(
    screenshot,
    testInfo.project.name === 'capture-desktop'
      ? { width: 2880, height: 1800 }
      : { width: 780, height: 1688 },
  );
  assertNoBrowserErrors();
});

const templatePreviews = [
  { label: 'Magnet', file: 'magnet' },
  { label: 'Name keychain', file: 'name-keychain' },
  { label: 'Articulated name', file: 'articulated-name' },
  { label: 'Nameplate', file: 'nameplate' },
  { label: 'Plant label', file: 'plant-label' },
] as const;

const stylePreviews = [
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Plain',
    file: 'magnet',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Contour',
    file: 'magnet-contour',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Capsule',
    file: 'magnet-capsule',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Soft tag',
    file: 'magnet-soft-tag',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Bubble',
    file: 'magnet-bubble',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Arch',
    file: 'magnet-arch',
  },
  {
    template: 'Magnet',
    templateFile: 'magnet',
    style: 'Ribbon',
    file: 'magnet-ribbon',
  },
  {
    template: 'Name keychain',
    templateFile: 'name-keychain',
    style: 'Contour',
    file: 'name-keychain-contour',
  },
  {
    template: 'Name keychain',
    templateFile: 'name-keychain',
    style: 'Capsule',
    file: 'name-keychain-capsule',
  },
  {
    template: 'Name keychain',
    templateFile: 'name-keychain',
    style: 'Soft tag',
    file: 'name-keychain-soft-tag',
  },
  {
    template: 'Name keychain',
    templateFile: 'name-keychain',
    style: 'Bubble',
    file: 'name-keychain-bubble',
  },
  {
    template: 'Name keychain',
    templateFile: 'name-keychain',
    style: 'Arch',
    file: 'name-keychain-arch',
  },
  {
    template: 'Plant label',
    templateFile: 'plant-label',
    style: 'Contour',
    file: 'plant-label-contour',
  },
  {
    template: 'Plant label',
    templateFile: 'plant-label',
    style: 'Capsule',
    file: 'plant-label-capsule',
  },
  {
    template: 'Plant label',
    templateFile: 'plant-label',
    style: 'Soft tag',
    file: 'plant-label-soft-tag',
  },
  {
    template: 'Plant label',
    templateFile: 'plant-label',
    style: 'Bubble',
    file: 'plant-label-bubble',
  },
  { template: 'Plant label', templateFile: 'plant-label', style: 'Arch', file: 'plant-label-arch' },
] as const;

const waitForRegeneration = async (
  page: Parameters<typeof waitForReadyGeometry>[0],
  previousGeneration: string | null,
): Promise<void> => {
  const preview = page.locator('.preview-panel');
  await expect
    .poll(() => preview.getAttribute('data-generation-id'), { timeout: 15_000 })
    .not.toBe(previousGeneration);
  await waitForReadyGeometry(page);
};

for (const template of templatePreviews) {
  test(`captures the ${template.label.toLowerCase()} template preview`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'capture-mobile-2x',
      'The 2x project captures only the hero.',
    );
    const suffix = testInfo.project.name === 'capture-mobile' ? 'mobile' : 'desktop';
    const assertNoBrowserErrors = watchBrowserErrors(page);

    await mkdir('public/showcase/templates', { recursive: true });
    await page.goto('/create');
    await waitForReadyGeometry(page);
    const previousGeneration = await page
      .locator('.preview-panel')
      .getAttribute('data-generation-id');
    const templateButton = page
      .locator('.template-grid button')
      .filter({ hasText: template.label });
    const templateWasSelected = (await templateButton.getAttribute('aria-pressed')) === 'true';
    await templateButton.click();
    if (templateWasSelected) await waitForReadyGeometry(page);
    else await waitForRegeneration(page, previousGeneration);
    await prepareForCapture(page);
    await assertVisibleModel(page);
    const viewer = page.locator('.viewer-wrap');
    const viewerBounds = await viewer.boundingBox();
    expect(viewerBounds).not.toBeNull();
    const screenshot =
      testInfo.project.name === 'capture-desktop'
        ? await page.screenshot({
            clip: {
              x: viewerBounds!.x + Math.max(0, (viewerBounds!.width - 640) / 2),
              y: viewerBounds!.y + Math.max(0, (viewerBounds!.height - 360) / 2),
              width: 640,
              height: 360,
            },
            animations: 'disabled',
          })
        : await sharp(await viewer.screenshot({ animations: 'disabled' }))
            .resize({ width: 1280, height: 720, fit: 'cover', position: 'centre' })
            .png()
            .toBuffer();
    const assetTarget = `public/showcase/templates/${template.file}${suffix === 'mobile' ? '-mobile' : ''}.png`;
    await sharp(screenshot).toFile(assetTarget);
    await assertPngCapture(screenshot, { width: 1280, height: 720 });
    assertNoBrowserErrors();
  });
}

for (const style of stylePreviews) {
  test(`captures the ${style.template.toLowerCase()} ${style.style.toLowerCase()} style preview`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'capture-mobile' || testInfo.project.name === 'capture-mobile-2x',
      'Style cards use the desktop capture recipe.',
    );
    const assertNoBrowserErrors = watchBrowserErrors(page);

    await mkdir('public/showcase/styles', { recursive: true });
    await page.goto('/create');
    await waitForReadyGeometry(page);
    const previousTemplateGeneration = await page
      .locator('.preview-panel')
      .getAttribute('data-generation-id');
    const styleTemplateButton = page.getByRole('button', { name: style.template, exact: true });
    const templateWasSelected = (await styleTemplateButton.getAttribute('aria-pressed')) === 'true';
    await styleTemplateButton.click();
    if (templateWasSelected) await waitForReadyGeometry(page);
    else await waitForRegeneration(page, previousTemplateGeneration);
    const styleButton = page.getByRole('button', { name: style.style, exact: true });
    await expect(styleButton).toBeVisible();
    const styleWasSelected = (await styleButton.getAttribute('aria-pressed')) === 'true';
    const previousStyleGeneration = await page
      .locator('.preview-panel')
      .getAttribute('data-generation-id');
    await styleButton.click();
    await expect(styleButton).toHaveAttribute('aria-pressed', 'true');
    if (styleWasSelected) await waitForReadyGeometry(page);
    else await waitForRegeneration(page, previousStyleGeneration);
    await prepareForCapture(page);
    await assertVisibleModel(page);
    const viewer = page.locator('.viewer-wrap');
    const viewerBounds = await viewer.boundingBox();
    expect(viewerBounds).not.toBeNull();
    const screenshot = await page.screenshot({
      clip: {
        x: viewerBounds!.x + Math.max(0, (viewerBounds!.width - 640) / 2),
        y: viewerBounds!.y + Math.max(0, (viewerBounds!.height - 360) / 2),
        width: 640,
        height: 360,
      },
      animations: 'disabled',
    });
    const assetTarget = `public/showcase/styles/${style.file}.png`;
    await sharp(screenshot).toFile(assetTarget);
    await assertPngCapture(screenshot, { width: 1280, height: 720 });
    assertNoBrowserErrors();
  });
}
