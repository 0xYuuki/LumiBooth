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
  const back = page.locator('.booth-back');
  await expect(back).toBeVisible();
  expect(await back.evaluate((node) => node.parentElement.className)).toBe('booth-step-navigation');
}

test('Photos workspace preserves selection, order and edits across Home and Back', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await expect(page.getByRole('heading', { name: 'Your strip starts here.' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByRole('heading', { name: 'Let’s fill your strip.' })).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeDisabled();
  await addPhotos(page, 3);
  await expect(page.getByLabel('Include photo 3', { exact: true })).toBeDisabled();
  await page.getByLabel('Include photo 1', { exact: true }).uncheck();
  await page.getByLabel('Include photo 3', { exact: true }).check();
  await page.getByLabel('Include photo 2', { exact: true }).uncheck();
  await page.getByLabel('Include photo 2', { exact: true }).check();
  await expect(page.getByLabel('Include photo 3', { exact: true }).getByLabel('Strip position 1')).toBeVisible();
  const sources = await page.locator('.workspace-strip-miniature img[alt^="Captured photo"]').evaluateAll((nodes) => nodes.map((node) => node.src));
  await noOverflow(page);
  const list = await page.locator('.gallery-import-list').boundingBox();
  const actions = await page.locator('.gallery-import-footer').boundingBox();
  expect(actions.y).toBeGreaterThanOrEqual(list.y + list.height);
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await page.getByRole('link', { name: 'Continue your strip' }).click();
  await expect(page.getByLabel('Include photo 1', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByRole('img', { name: /Captured photo/ })).toHaveCount(2);
  expect(await page.getByRole('img', { name: /Captured photo/ }).evaluateAll((nodes) => nodes.map((node) => node.src))).toEqual(sources);
  await page.getByLabel('Caption under LumiBooth (optional)').fill('Keep this caption');
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.locator('.gallery-import-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Keep this caption');
  await noOverflow(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await noOverflow(page);
  const finish = page.getByRole('button', { name: 'Back to home' });
  await expect(finish).toBeVisible();
  expect(await finish.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Keep this caption');
});

test('camera captures go to review and can be replaced by gallery or retaken before editing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
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
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeDisabled();
  await page.getByLabel('Include photo 2', { exact: true }).check();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByRole('img', { name: 'Captured photo 1' })).toHaveAttribute('src', /^blob:/);
});

test('camera can switch to an empty gallery review without losing the layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Triple Strip/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('link', { name: /Choose from Gallery \/ Review photos/ }).click();
  await expect(page.getByRole('button', { name: /Triple Strip/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Add from gallery' })).toBeEnabled();
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await page.getByRole('link', { name: 'Continue your strip' }).click();
  await expect(page.getByRole('button', { name: /Triple Strip/ })).toHaveAttribute('aria-pressed', 'true');
});

test('five gallery photos suggest six slots without dropping photos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await addPhotos(page, 5);
  await expect(page.getByRole('button', { name: /6-Grid Wide/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.gallery-import-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeDisabled();
  await expect(page.getByText('Add one more photo for this layout, or choose 4 photos and select your favorites.')).toBeVisible();
  await page.getByRole('button', { name: /4-Grid Classic/ }).click();
  await expect(page.locator('.gallery-import-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeEnabled();
});

test('tap order, confirmed removal, undo and local draft recovery keep the design', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await addPhotos(page, 3);
  await page.getByRole('button', { name: 'Choose order' }).click();
  await page.getByLabel('Include photo 3', { exact: true }).check();
  await page.getByLabel('Include photo 1', { exact: true }).check();
  await expect(page.getByLabel('Include photo 3', { exact: true }).getByLabel('Strip position 1')).toBeVisible();
  await expect(page.getByLabel('Include photo 1', { exact: true }).getByLabel('Strip position 2')).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo 3', exact: true }).click();
  await page.getByRole('button', { name: 'Keep photo' }).click();
  await expect(page.locator('.shot-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Remove photo 3', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.locator('.shot-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.shot-card')).toHaveCount(3);
  await expect(page.getByLabel('Include photo 3', { exact: true }).getByLabel('Strip position 1')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await page.getByRole('slider', { name: 'Zoom' }).fill('2');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Caption under LumiBooth (optional)').fill('Saved locally');
  await page.setViewportSize({ width: 360, height: 740 });
  const previewBefore = await page.locator('.design-stage').boundingBox();
  const tabsBefore = await page.locator('.design-tabs').boundingBox();
  const controls = page.getByLabel('Editing controls', { exact: true });
  await controls.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => controls.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.design-stage').boundingBox()).toEqual(previewBefore);
  expect(await page.locator('.design-tabs').boundingBox()).toEqual(tabsBefore);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);

  await expect.poll(() => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-local-draft', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('drafts').objectStore('drafts').get('current');
      read.onsuccess = () => { resolve(read.result?.session.caption); db.close(); };
    };
  }))).toBe('Saved locally');
  await page.reload();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Saved locally');
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await expect(page.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await expect(page.getByLabel('Include photo 3', { exact: true }).getByLabel('Strip position 1')).toBeVisible();
  await expect(page.locator('.shot-select img').first()).toHaveJSProperty('naturalWidth', 80);
});

test('removing the only photo keeps Undo available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await addPhotos(page, 1);
  await page.getByRole('button', { name: 'Remove photo 1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.locator('.shot-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.shot-card')).toHaveCount(1);
  await expect(page.locator('.shot-select img')).toHaveJSProperty('naturalWidth', 80);
});
