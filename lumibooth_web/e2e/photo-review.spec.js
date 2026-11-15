import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function addPhotos(page, count) {
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    const context = canvas.getContext('2d');
    context.fillStyle = '#b494df';
    context.fillRect(0, 0, 80, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Choose image files').setInputFiles(Array.from({ length: count }, (_, index) => ({
    name: `memory-${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64'),
  })));
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const back = page.getByRole('link', { name: 'Back to previous step' });
  await expect(back).toBeVisible();
  expect(await back.evaluate((node) => node.parentElement.className)).toBe('booth-step-navigation');
}

test('gallery starts with shared layout and preserves selection, order and edits across back navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose from Gallery', exact: true }).click();
  await expect(page).toHaveURL(/\/layout\?source=gallery$/);
  await expect(page.getByRole('heading', { name: 'Choose your layout.' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByRole('heading', { name: 'Let’s fill your strip.' })).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start editing' })).toBeDisabled();
  await addPhotos(page, 3);
  await expect(page.getByLabel('Include photo 3', { exact: true })).toBeDisabled();
  await page.getByLabel('Include photo 1', { exact: true }).uncheck();
  await page.getByLabel('Include photo 3', { exact: true }).check();
  await page.getByRole('button', { name: 'Move photo 3 up' }).click();
  await expect(page.locator('.gallery-import-card[data-selected="true"] strong')).toHaveText(['memory-3.png', 'memory-2.png']);
  const sources = await page.locator('.gallery-import-card[data-selected="true"] img').evaluateAll((nodes) => nodes.map((node) => node.src));
  await noOverflow(page);
  const list = await page.locator('.gallery-import-list').boundingBox();
  const actions = await page.locator('.gallery-import-footer').boundingBox();
  expect(actions.y).toBeGreaterThanOrEqual(list.y + list.height);
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await expect(page.getByLabel('Include photo 1', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Start editing' }).click();
  await expect(page.getByRole('img', { name: /Captured photo/ })).toHaveCount(2);
  expect(await page.getByRole('img', { name: /Captured photo/ }).evaluateAll((nodes) => nodes.map((node) => node.src))).toEqual(sources);
  await page.getByLabel('Caption under LumiBooth (optional)').fill('Keep this caption');
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.locator('.gallery-import-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Start editing' }).click();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Keep this caption');
  await noOverflow(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await noOverflow(page);
  const finish = page.getByRole('button', { name: 'Finish Session' });
  await expect(finish).toBeVisible();
  expect(await finish.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Keep this caption');
});

test('camera captures go to review and can be replaced by gallery or retaken before editing', async ({ page }) => {
  await page.goto('/layout');
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByLabel('Include photo 1', { exact: true })).toBeChecked();
  await addPhotos(page, 1);
  // A full strip can still take an alternative without losing its current selection.
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.locator('.gallery-import-card')).toHaveCount(3);
  await expect(page.getByLabel('Include photo 1', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Include photo 3', { exact: true })).not.toBeChecked();
  await page.getByLabel('Include photo 1', { exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Start editing' })).toBeDisabled();
  await page.getByLabel('Include photo 2', { exact: true }).check();
  await page.getByRole('button', { name: 'Start editing' }).click();
  await expect(page.getByRole('img', { name: 'Captured photo 1' })).toHaveAttribute('src', /^blob:/);
});

test('camera can switch to an empty gallery review without losing the layout', async ({ page }) => {
  await page.goto('/layout');
  await page.getByRole('button', { name: /Triple Strip/ }).click();
  await page.getByRole('link', { name: /Choose from Gallery \/ Review photos/ }).click();
  await expect(page.getByText('Triple Strip', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add photos' })).toBeEnabled();
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.getByRole('button', { name: /Triple Strip/ })).toHaveAttribute('aria-pressed', 'true');
});
