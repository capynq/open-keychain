import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { encodeDesignDocument } from '../src/domain/keychain/design-document';
import { createDesignDocument } from '../src/domain/keychain/model/design-schema';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';

/* Worker compute time is measured inside the worker, so a delayed response would only inflate the round trip; this harness rewrites the reported compute time of adopted builds instead. */
const installPreviewQualityHarness = (): void => {
  localStorage.setItem('open-keychain.analytics-consent', 'declined');
  const OriginalWorker = window.Worker;
  const control = { slowBuilds: false, rejectChamfer: false };
  Object.assign(window, { previewQualityTest: control });
  window.Worker = class extends OriginalWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      if (!String(url).includes('geometry-worker')) return;
      this.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as {
          type?: string;
          result?: { timings?: Record<string, number> };
        };
        const timings = data.result?.timings;
        if (
          control.slowBuilds &&
          (data.type === 'geometry' || data.type === 'validation') &&
          timings &&
          timings.workerCacheHit !== 1
        )
          timings.workerComputeMs = 3000;
      });
    }
    override postMessage(message: unknown, transfer: Transferable[]): void;
    override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
    override postMessage(
      message: unknown,
      transferOrOptions?: Transferable[] | StructuredSerializeOptions,
    ): void {
      const request = message as {
        type?: string;
        requestId?: number;
        params?: { textEdgeFinish?: string };
      };
      if (
        control.rejectChamfer &&
        request.type === 'validate' &&
        request.params?.textEdgeFinish === 'chamfer'
      ) {
        const requestId = request.requestId;
        queueMicrotask(() =>
          this.dispatchEvent(
            new MessageEvent('message', {
              data: {
                type: 'error',
                requestId,
                message: 'Injected candidate rejection for e2e coverage.',
                failure: {
                  code: 'text-edge-too-large',
                  message: 'Injected candidate rejection for e2e coverage.',
                  context: { target: 'text', profile: 'round', maximumMm: 0.2, requestedMm: 0.4 },
                },
              },
            }),
          ),
        );
        return;
      }
      if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
      else super.postMessage(message, transferOrOptions);
    }
  };
};

test('steps the preview to the low tier and keeps exports at full quality', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(installPreviewQualityHarness);
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 15_000 });
  const preview = page.locator('.preview-panel');
  await expect(preview).toHaveAttribute('data-preview-quality', 'high');

  await page.evaluate(() => {
    (
      window as unknown as { previewQualityTest: { slowBuilds: boolean } }
    ).previewQualityTest.slowBuilds = true;
  });
  const textInput = page.getByLabel('Name or text');
  const expectedTiers = ['high', 'medium', 'medium', 'low'] as const;
  for (const [index, text] of ['MILA', 'LENA', 'OLGA', 'ANNA'].entries()) {
    await textInput.fill(text);
    await expect(preview).toHaveAttribute('data-preview-quality', expectedTiers[index], {
      timeout: 30_000,
    });
    await expect(page.locator('.candidate-feedback[role="status"]')).toHaveCount(0, {
      timeout: 30_000,
    });
  }

  await expect(preview).toHaveAttribute('data-renderer-state', 'ready', { timeout: 30_000 });
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
  await expect(preview).toHaveAttribute('data-rendered-generation-id', /^\d+$/);
  await expect(preview).toHaveAttribute('data-model-ready', 'true');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 30_000 });
  await expect(preview).toHaveAttribute('data-preview-quality', 'low');

  await page.evaluate(() => {
    (
      window as unknown as { previewQualityTest: { slowBuilds: boolean } }
    ).previewQualityTest.slowBuilds = false;
  });
  await page.locator('.export-header-button').click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  const lowDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  const lowFile = await lowDownload;
  expect(lowFile.suggestedFilename()).toMatch(/\.stl$/);
  await expect(dialog).toContainText('Download ready');
  const lowTriangles = readFileSync(await lowFile.path()).readUInt32LE(80);

  const design = encodeDesignDocument(createDesignDocument({ ...DEFAULT_PARAMS, text: 'ANNA' }));
  await page.goto(`/create?${new URLSearchParams({ design }).toString()}`);
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 15_000 });
  await page.locator('.export-header-button').click();
  const fullDialog = page.getByRole('dialog', { name: 'Choose an export' });
  const fullDownload = page.waitForEvent('download');
  await fullDialog.getByRole('button', { name: /STL file/ }).click();
  const fullFile = await fullDownload;
  expect(readFileSync(await fullFile.path()).readUInt32LE(80)).toBe(lowTriangles);
});

test('a rejected edit restores the accepted mesh', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(installPreviewQualityHarness);
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 15_000 });
  const preview = page.locator('.preview-panel');
  await expect(preview).toHaveAttribute('data-preview-quality', 'high');

  await page.evaluate(() => {
    (
      window as unknown as { previewQualityTest: { slowBuilds: boolean } }
    ).previewQualityTest.slowBuilds = true;
  });
  const textInput = page.getByLabel('Name or text');
  for (const text of ['MILA', 'LENA', 'OLGA', 'ANNA']) {
    await textInput.fill(text);
    await expect(page.locator('.candidate-feedback[role="status"]')).toHaveCount(0, {
      timeout: 30_000,
    });
  }
  await expect(preview).toHaveAttribute('data-preview-quality', 'low', { timeout: 30_000 });
  await expect(preview).toHaveAttribute('data-renderer-state', 'ready', { timeout: 30_000 });
  await expect(preview).toHaveAttribute('data-model-ready', 'true');
  const acceptedGeneration = await preview.getAttribute('data-generation-id');
  if (!acceptedGeneration) throw new Error('The accepted preview has no generation id.');
  await expect(preview).toHaveAttribute('data-rendered-generation-id', acceptedGeneration);

  await page.evaluate(() => {
    (
      window as unknown as { previewQualityTest: { rejectChamfer: boolean } }
    ).previewQualityTest.rejectChamfer = true;
  });
  const backingProfile = page.getByRole('radiogroup', { name: 'Text profile', exact: true });
  await backingProfile.getByRole('radio', { name: 'Chamfer' }).click();
  await expect(page.locator('.candidate-feedback-rejected [role="alert"]')).toContainText(
    'The text edge is too large for this design',
    { timeout: 30_000 },
  );
  await expect(preview).toHaveAttribute('data-generation-id', acceptedGeneration);
  await expect(preview).toHaveAttribute('data-rendered-generation-id', acceptedGeneration);
  await expect(preview).toHaveAttribute('data-model-ready', 'true');
  await expect(backingProfile.getByRole('radio', { name: 'Sharp', exact: true })).toBeChecked();
  await expect(page.locator('.export-header-button')).toBeEnabled();

  await page.evaluate(() => {
    (
      window as unknown as { previewQualityTest: { rejectChamfer: boolean } }
    ).previewQualityTest.rejectChamfer = false;
  });
});
