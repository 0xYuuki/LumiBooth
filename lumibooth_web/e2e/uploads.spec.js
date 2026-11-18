import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

async function png(page, name, color, inset = 0) {
  const base64 = await page.evaluate(({ color, inset }) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 60;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(inset, inset, 60 - 2 * inset, 60 - 2 * inset);
    return canvas.toDataURL().split(',')[1];
  }, { color, inset });
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('guest stickers and backgrounds survive library deletion in a saved strip', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByLabel('Choose image files').setInputFiles(await png(page, 'photo.png', '#00bb00'));
  await page.getByRole('button', { name: 'Continue to design' }).click();

  await page.getByRole('button', { name: 'My backgrounds' }).click();
  await page.getByLabel('Upload your own background').setInputFiles(await png(page, 'Backdrop.png', '#ff0000'));
  await expect(page.getByRole('img', { name: 'Background placement preview' })).toBeVisible();
  await page.getByLabel('Background fit').selectOption('contain');
  await page.getByLabel('Vertical position').fill('0');
  await page.getByRole('button', { name: 'Apply background' }).click();
  const strip = page.locator('.editor-preview-fit .photo-strip');
  await expect(strip).toHaveCSS('background-size', 'contain');
  await expect(strip).toHaveCSS('background-position', '50% 0%');

  await page.getByRole('button', { name: 'Stickers', exact: true }).click();
  await page.getByRole('button', { name: 'My stickers' }).click();
  await page.getByLabel('Upload your own sticker').setInputFiles({
    name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.getByRole('alert')).toHaveText('Choose a still PNG, JPEG, or WebP image.');
  await page.getByLabel('Upload your own sticker').setInputFiles(await png(page, 'Stamp.png', '#ff00ff', 12));
  await page.getByRole('button', { name: 'Add sticker' }).click();
  const sticker = strip.locator('.custom-sticker-art');
  await expect(sticker).toBeVisible();
  await page.getByLabel('Sticker rotation').fill('35');
  await page.getByLabel('Sticker size').fill('85');
  await expect(sticker.locator('..')).toHaveAttribute('style', 'transform: rotate(35deg);');
  await page.getByRole('button', { name: '✨', exact: true }).click();
  await page.getByLabel('Sticker layer').selectOption({ label: 'Stamp · Layer 1' });
  await page.getByRole('button', { name: 'Bring sticker forward' }).click();
  await expect(strip.locator('.strip-sticker').last().locator('.custom-sticker-art')).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  const output = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  const colors = await output.evaluate(async img => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    const red = context.getImageData(5, 5, 1, 1).data;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let foundStamp = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 220 && pixels[i + 1] < 45 && pixels[i + 2] > 220) {
        foundStamp = true;
        break;
      }
    }
    return { red: [...red], foundStamp };
  });
  expect(colors.red[0]).toBeGreaterThan(220);
  expect(colors.red[1]).toBeLessThan(40);
  expect(colors.foundStamp).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(output).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Save to Your works' }).click();
  const saved = page.getByRole('link', { name: 'View in Your works' });
  await expect(saved).toBeVisible();
  const workPath = await saved.getAttribute('href');
  await page.goto('/uploads');
  await page.reload();
  await expect(page.getByText('Stamp', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Renamed stamp'));
  await page.getByRole('button', { name: 'Rename Stamp' }).click();
  await expect(page.getByText('Renamed stamp', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Renamed stamp' }).click();
  await expect(page.getByText('No uploads yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Backgrounds', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Backdrop' }).click();
  await expect(page.getByText('No uploads yet.')).toBeVisible();

  await page.goto(workPath);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(sticker).toBeVisible();
  await expect(sticker.locator('..')).toHaveAttribute('style', 'transform: rotate(35deg);');
  await expect(strip).toHaveCSS('background-position', '50% 0%');
});
