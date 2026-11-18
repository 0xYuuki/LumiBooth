import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const backend = process.env.VITE_LUMI_SUPABASE_URL;
test.skip(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(backend ?? '') ||
  process.env.VITE_LUMI_CLOUD_BACKUP !== 'true', 'Run against the local Supabase backup build.');

async function saveStrip(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  const png = await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1]);
  await page.getByLabel('Choose image files').setInputFiles({
    name: 'guest.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByLabel('Caption under LumiBooth (optional)').fill('Private keepsake');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Save to Your works' }).click();
  await expect(page.getByRole('link', { name: 'View in Your works' })).toBeVisible();
}

async function account(page, email, signup) {
  await page.goto('/account');
  if (signup) await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('local-test-password-123');
  await page.getByRole('button', { name: signup ? 'Create an account' : 'Log in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
}

test('explicit backup retries safely and restores an editable strip in another browser', async ({ page, browser, baseURL }) => {
  const email = `backup-${Date.now()}@example.com`;
  await saveStrip(page);
  await account(page, email, true);
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.goto('/works');
  await expect(page.locator('.works-grid li')).toHaveCount(1);
  await page.getByRole('link', { name: 'Cloud backup' }).click();
  await expect(page.getByText('No backups yet.')).toBeVisible();

  await page.getByRole('checkbox', { name: /Private keepsake/ }).check();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  await expect(page.getByText('No backups yet.')).toBeVisible();
  let interrupt = true;
  await page.route('**/storage/v1/object/lumi-private-backups/**', async route => {
    if (route.request().method() === 'POST' && interrupt) {
      interrupt = false;
      await route.abort();
    } else {
      await route.continue();
    }
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  await expect(page.getByRole('alert')).toContainText('Upload failed');
  await expect(page.getByText('No backups yet.')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  await expect(page.getByText('1 of 1 selected strips backed up.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore strip' })).toHaveCount(1);

  const another = await browser.newContext({ baseURL });
  try {
    const next = await another.newPage();
    await account(next, email, false);
    await next.getByRole('link', { name: 'Back up my existing strips' }).click();
    await expect(next.getByText('Save a finished strip to Your works to back it up.')).toBeVisible();
    await next.route('**/storage/v1/object/lumi-private-backups/**', route => route.abort(), { times: 1 });
    await next.getByRole('button', { name: 'Restore strip' }).click();
    await expect(next.getByRole('alert')).toBeVisible();
    await expect(next.getByText('Save a finished strip to Your works to back it up.')).toBeVisible();
    await next.getByRole('button', { name: 'Restore strip' }).click();
    await expect(next.getByText('Strip restored to Your works.')).toBeVisible();
    await next.getByRole('button', { name: 'Restore strip' }).click();
    await expect(next.getByText('This strip is already in Your works.')).toBeVisible();
    next.once('dialog', dialog => dialog.accept());
    await next.getByRole('button', { name: 'Delete backup' }).click();
    await expect(next.getByText('No backups yet.')).toBeVisible();
    await next.getByRole('link', { name: 'Back to Your works' }).click();
    await expect(next.locator('.works-grid li')).toHaveCount(1);
    await next.getByRole('link', { name: /Private keepsake/ }).click();
    await next.getByRole('button', { name: 'Edit Strip' }).click();
    await expect(next.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Private keepsake');
    await expect(next.getByRole('img', { name: 'Captured photo 1' })).toBeVisible();
    await page.goto('/works');
    await expect(page.locator('.works-grid li')).toHaveCount(1);
  } finally {
    await another.close();
  }
});

test('upload backup is selective, restores once, and keeps local copies on cloud deletion', async ({ page, browser, baseURL }) => {
  const email = `uploads-${Date.now()}@example.com`;
  await page.goto('/uploads');
  const png = Buffer.from(await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1]), 'base64');
  await page.getByLabel('Upload your own sticker').setInputFiles({ name: 'Moon.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Moon', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Backgrounds', exact: true }).click();
  await page.getByLabel('Upload your own background').setInputFiles({ name: 'Night sky.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Night sky', { exact: true })).toBeVisible();

  const writes = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/storage/v1/object/lumi-private-uploads/')) writes.push(request.url());
  });
  await account(page, email, true);
  await page.goto('/uploads');
  await page.getByRole('link', { name: 'Cloud backup' }).click();
  await expect(page.getByText('No backups yet.')).toBeVisible();
  expect(writes).toHaveLength(0);

  await page.getByRole('checkbox', { name: /Moon/ }).check();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  expect(writes).toHaveLength(0);

  await page.route('**/storage/v1/object/lumi-private-uploads/**', route => route.abort(), { times: 1 });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  await expect(page.getByRole('alert')).toContainText('Upload failed');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Back up selected/ }).click();
  await expect(page.getByText('1 of 1 selected uploads backed up.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore upload' })).toHaveCount(1);
  expect(new Set(writes).size).toBe(1);

  await page.getByRole('link', { name: 'Back to My Uploads' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Moon' }).click();
  await expect(page.getByText('No uploads yet.')).toBeVisible();

  const another = await browser.newContext({ baseURL });
  try {
    const next = await another.newPage();
    await account(next, email, false);
    await next.goto('/uploads/backup');
    await expect(next.getByText(/Moon · Sticker backed up/)).toBeVisible();
    await expect(next.getByText(/Night sky/)).toHaveCount(0);
    await next.getByRole('button', { name: 'Restore upload' }).click();
    await expect(next.getByText('Upload restored to My Uploads.')).toBeVisible();
    await next.getByRole('button', { name: 'Restore upload' }).click();
    await expect(next.getByText('This upload is already in My Uploads.')).toBeVisible();
    next.once('dialog', dialog => dialog.accept());
    await next.getByRole('button', { name: 'Delete backup' }).click();
    await expect(next.getByText('No backups yet.')).toBeVisible();
    await next.getByRole('link', { name: 'Back to My Uploads' }).click();
    await expect(next.getByText('Moon', { exact: true })).toHaveCount(1);
  } finally {
    await another.close();
  }
});
