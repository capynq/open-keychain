import { expect, test, type Download } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

import { assertVisibleModel, waitForReadyGeometry, watchBrowserErrors } from './helpers';

const verifyDownload = async (
  download: Download,
  format: 'stl' | '3mf',
  mode?: 'merged' | 'separate-colors',
) => {
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  if (format === 'stl') {
    expect(bytes.length).toBeGreaterThan(84);
    const triangles = bytes.readUInt32LE(80);
    expect(triangles).toBeGreaterThan(0);
    expect(bytes.length).toBe(84 + triangles * 50);
  } else {
    const archive = unzipSync(bytes);
    expect(archive['[Content_Types].xml']).toBeDefined();
    expect(archive['_rels/.rels']).toBeDefined();
    const model = strFromU8(archive['3D/3dmodel.model']);
    expect(model).toContain('<mesh>');
    expect(model).toContain('<vertex ');
    expect(model).toContain('<triangle ');
    expect(model).toContain('<item objectid=');
    if (mode === 'separate-colors') {
      expect(model.match(/<base name=/g)).toHaveLength(2);
      expect(model).toContain('displaycolor="#123456"');
      expect(model).toContain('displaycolor="#FEDCBA"');
      const volumes = strFromU8(archive['Metadata/Slic3r_PE_model.config']);
      expect(volumes.match(/<volume firstid=/g)).toHaveLength(2);
    } else {
      expect(mode).toBe('merged');
      expect(model.match(/<base name=/g)).toHaveLength(1);
      expect(archive['Metadata/Slic3r_PE_model.config']).toBeUndefined();
    }
  }
};

test('critical journey: landing, setup, edit, preview, STL and both 3MF exports', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Start designing', exact: true }).first().click();
  await expect(page).toHaveURL(/\/create\?setup=1&lang=en$/);
  const setup = page.getByTestId('quick-setup-dialog');
  const next = setup.getByRole('button', { name: 'Next', exact: true });
  await expect(
    setup.getByRole('heading', { name: 'Name and model size', exact: true }),
  ).toBeVisible();
  await setup.getByLabel('Name or text').fill('OLIVER');
  await setup.getByLabel(/80 × 30/).check();
  await next.click();
  await expect(
    setup.getByRole('heading', { name: 'Keyring hole position', exact: true }),
  ).toBeVisible();
  await setup.getByRole('radio', { name: 'Top', exact: true }).check();
  await next.click();
  await expect(
    setup.getByRole('heading', { name: 'Keyring opening shape and size', exact: true }),
  ).toBeVisible();
  await setup.getByRole('radio', { name: /Standard round/ }).check();
  await next.click();
  await expect(
    setup.getByRole('heading', { name: 'Choose font categories', exact: true }),
  ).toBeVisible();
  for (const category of ['Calligraphic', 'Handwritten']) {
    await setup.getByRole('checkbox', { name: category, exact: true }).uncheck();
  }
  await setup.getByRole('checkbox', { name: 'Rounded', exact: true }).check();
  await next.click();
  await setup.getByLabel('Base color', { exact: true }).fill('#123456');
  await setup.getByLabel('Text color', { exact: true }).fill('#fedcba');
  await next.click();
  await expect(setup.getByRole('heading', { name: 'Ready to create', exact: true })).toBeVisible();
  await setup.getByRole('button', { name: 'Start designing', exact: true }).click();
  await expect(setup).toBeHidden();
  await waitForReadyGeometry(page);
  await assertVisibleModel(page);

  const preview = page.locator('.preview-panel');
  const initialGeneration = await preview.getAttribute('data-generation-id');
  await page.getByLabel('Name or text').fill('NORA');
  await expect(preview).not.toHaveAttribute('data-generation-id', initialGeneration!);
  await waitForReadyGeometry(page);
  await assertVisibleModel(page);
  await page.locator('.export-header-button').click();
  const exports = page.getByRole('dialog', { name: 'Choose an export' });
  for (const [name, format, mode] of [
    [/STL file/, 'stl', undefined],
    [/3MF.*merged object/, '3mf', 'merged'],
    [/3MF.*separate colors/, '3mf', 'separate-colors'],
  ] as const) {
    const download = page.waitForEvent('download');
    await exports.getByRole('button', { name }).click();
    await verifyDownload(await download, format, mode);
    await expect(exports).toContainText('Download ready');
    await expect(exports.getByRole('alert')).toHaveCount(0);
  }
  await exports.locator('.modal-close').click();
  await expect(exports).toBeHidden();
  await page.getByLabel('Name or text').fill('ALEX');
  await waitForReadyGeometry(page);
  await page.locator('.export-header-button').click();
  const repeatedDownload = page.waitForEvent('download');
  await exports.getByRole('button', { name: /STL file/ }).click();
  await verifyDownload(await repeatedDownload, 'stl');
  expect((await repeatedDownload).suggestedFilename()).toContain('alex');
  assertNoBrowserErrors();
});
