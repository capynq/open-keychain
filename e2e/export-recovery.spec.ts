import { expect, test } from '@playwright/test';

// Inject browser worker events rather than terminating real geometry during a WASM call.
test('retries a failed export after recovery is exhausted and switches formats without reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
    const workers: Worker[] = [];
    const OriginalWorker = window.Worker;
    const control = { workers, failNextExport: false };
    Object.assign(window, { exportRecoveryTest: control });
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes('geometry-worker')) workers.push(this);
      }
      override postMessage(
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ): void {
        if (control.failNextExport && (message as { type?: string }).type === 'export') {
          control.failNextExport = false;
          queueMicrotask(() => this.dispatchEvent(new Event('error')));
          return;
        }
        if (Array.isArray(options)) super.postMessage(message, options);
        else super.postMessage(message, options);
      }
    };
  });
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 15_000 });
  await page.locator('.export-header-button').click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  await page.evaluate(() => {
    const control = (window as unknown as { exportRecoveryTest: { failNextExport: boolean } })
      .exportRecoveryTest;
    control.failNextExport = true;
  });
  await dialog.getByRole('button', { name: /STL file/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('worker stopped');
  await expect(dialog.getByRole('button', { name: 'Try again', exact: true })).toBeEnabled();
  // The automatic replacement fails before producing any response: its recovery budget is spent.
  await page.evaluate(() => {
    const control = (window as unknown as { exportRecoveryTest: { workers: Worker[] } })
      .exportRecoveryTest;
    const replacement = control.workers.at(-1)!;
    // Chromium does not deliver synthetic messageerror dispatches to this property handler.
    replacement.onmessageerror!.call(replacement, new MessageEvent('messageerror'));
  });
  const retryDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  expect((await retryDownload).suggestedFilename()).toMatch(/\.stl$/);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  for (const [name, extension] of [
    [/3MF.*merged object/, '3mf'],
    [/3MF.*separate colors/, '3mf'],
    [/STL file/, 'stl'],
  ] as const) {
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    await expect(dialog).toContainText('Download ready');
  }
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { exportRecoveryTest: { workers: Worker[] } }).exportRecoveryTest
          .workers.length,
    ),
  ).toBe(3);
});
