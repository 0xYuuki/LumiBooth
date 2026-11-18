import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function openDesign(page) {
  const bytes = await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1]);
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByLabel('Choose image files').setInputFiles({
    name: 'guest-photo.png', mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64'),
  });
  await page.getByRole('button', { name: 'Continue to design' }).click();
}

async function designStrip(page, caption) {
  await openDesign(page);
  await page.getByLabel('Caption under LumiBooth (optional)').fill(caption);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Save to Your works' }).click();
  await expect(page.getByRole('link', { name: 'View in Your works' })).toBeVisible();
}

test('guests can reopen, edit, print, download and delete saved strips offline', async ({ page, context }) => {
  await page.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printRequested = 'true'; };
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Your works', exact: true }).click();
  await expect(page.getByText('Save a finished strip to see it here.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to photo booth' }).click();
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await designStrip(page, 'First keepsake');
  await page.getByRole('button', { name: 'Back to home' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await designStrip(page, 'Second keepsake');
  await page.getByRole('button', { name: 'Back to home' }).click();
  await page.getByRole('link', { name: 'Your works', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();

  const cards = page.locator('.works-grid li');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Second keepsake');
  await cards.first().getByRole('link').click();
  const savedUrl = page.url();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Your saved LumiBooth photo strip' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save to Device' }).click();
  expect((await download).suggestedFilename()).toBe('lumibooth-strip.png');
  await page.getByRole('button', { name: 'Print Photo' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(page).toHaveURL(savedUrl);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(page.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('Second keepsake');
  await expect(page.getByRole('img', { name: 'Captured photo 1' })).toBeVisible();
  await page.goBack();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete saved strip' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('First keepsake');
  await page.goto(savedUrl);
  await expect(page.getByText('This strip is no longer in Your works.')).toBeVisible();

  const storageCounts = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-saved-works', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['works', 'details']);
      const works = tx.objectStore('works').count();
      const details = tx.objectStore('details').count();
      tx.oncomplete = () => { db.close(); resolve([works.result, details.result]); };
    };
  }));
  expect(storageCounts).toEqual([1, 1]);
});

test('failed saves leave no gallery entry and missing media stays deletable', async ({ page }) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    let failOnce = true;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'details' && failOnce) {
        failOnce = false;
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return add.apply(this, args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await openDesign(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save to Your works' });
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Could not save this strip');
  await expect(page.getByRole('link', { name: 'Save to Device' })).toBeVisible();
  await save.click();
  await page.getByRole('link', { name: 'View in Your works' }).click();
  await expect(page.getByRole('img', { name: 'Your saved LumiBooth photo strip' })).toBeVisible();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('lumibooth-saved-works', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('details', 'readwrite');
      const store = tx.objectStore('details');
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (entry) entry.update({ id: entry.primaryKey, poster: new Blob(['damaged']) });
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload();
  await expect(page.getByText('This strip image is missing or damaged.')).toBeVisible();
  await expect(page.getByText('Editable source photos are unavailable.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Your works' }).click();
  await expect(page.locator('.works-grid li')).toHaveCount(1);
  await page.locator('.works-grid a').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete saved strip' }).click();
  await expect(page.getByText('Save a finished strip to see it here.')).toBeVisible();
});
