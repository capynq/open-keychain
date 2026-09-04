import { expect, test as base } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import pg from 'pg';

import { waitForReadyGeometry } from './helpers';

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error('E2E_DATABASE_URL is required.');

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

type Identity = {
  email: string;
  name: string;
  password: string;
};

const test = base.extend<{ identity: Identity }>({
  identity: async ({ browserName }, run, testInfo) => {
    void browserName;
    const identity = {
      email: `e2e-${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}-${randomUUID()}@example.invalid`,
      name: 'E2E Seller',
      password: `E2e-${randomUUID()}-StrongPassword`,
    };

    try {
      await run(identity);
    } finally {
      await pool.query('DELETE FROM "user" WHERE email = $1', [identity.email]);
      const remaining = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "user" WHERE email = $1',
        [identity.email],
      );
      expect(remaining.rows[0]?.count).toBe('0');
    }
  },
});

test.afterAll(async () => {
  await pool.end();
});

test('registers, logs out, logs in, and completes the first STL export', async ({
  page,
  identity,
}) => {
  const usageRequests: Array<{ url: string; body: string }> = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/usage/')) {
      usageRequests.push({ url: request.url(), body: request.postData() ?? '' });
    }
  });

  await test.step('register a seller account', async () => {
    await page.goto('/profile?lang=en');
    await expect(page.getByRole('heading', { name: 'Your seller workspace' })).toBeVisible();
    await page
      .locator('.profile-auth form')
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await page.getByLabel('Full name').fill(identity.name);
    await page.getByLabel('Email').fill(identity.email);
    await page.getByLabel('Password').fill(identity.password);
    await page
      .locator('.profile-auth form')
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  });

  await test.step('sign out and sign back in with the same credentials', async () => {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await page.getByLabel('Email').fill(identity.email);
    await page.getByLabel('Password').fill(identity.password);
    await page
      .locator('.profile-auth form')
      .getByRole('button', { name: 'Sign in', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  });

  await test.step('export the first STL from the customizer', async () => {
    await page.goto('/create?lang=en');
    await waitForReadyGeometry(page);
    await page.getByLabel('Name or text').fill(`E2E-${identity.email.slice(4, 12)}`);

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: /STL file/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.stl$/i);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    expect((await stat(downloadPath as string)).size).toBeGreaterThan(0);
  });

  await test.step('verify server accounting without leaking form data', async () => {
    await expect.poll(() => usageRequests.length).toBeGreaterThanOrEqual(2);
    expect(usageRequests.some(({ url }) => url.endsWith('/api/usage/export-intent'))).toBe(true);
    expect(usageRequests.some(({ url }) => url.includes('/api/usage/export-complete/'))).toBe(true);
    for (const request of usageRequests) {
      expect(request.body).not.toContain(identity.email);
      expect(request.body).not.toContain(identity.password);
      expect(request.body).not.toContain('E2E-');
    }

    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM export_events e
       JOIN "user" u ON u.id = e.user_id
       WHERE u.email = $1`,
      [identity.email],
    );
    expect(result.rows[0]?.count).toBe('1');
  });
});

test('shows a generic error for a wrong password before a valid login', async ({
  page,
  identity,
}) => {
  await page.goto('/profile?lang=en');
  await page.locator('.profile-auth form').getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill(identity.name);
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(identity.password);
  await page.locator('.profile-auth form').getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();

  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(`${identity.password}-wrong`);
  await page
    .locator('.profile-auth form')
    .getByRole('button', { name: 'Sign in', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);

  await page.getByLabel('Password').fill(identity.password);
  await page
    .locator('.profile-auth form')
    .getByRole('button', { name: 'Sign in', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
});
