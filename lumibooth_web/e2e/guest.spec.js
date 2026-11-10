import { expect, test } from '@playwright/test';

test('a guest can capture, decorate, download, and finish a private session', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });

  await page.goto('/preview');
  const start = page.getByRole('link', { name: 'Start photo booth' });
  await expect(start).toBeVisible();
  await start.press('Enter');
  await page.getByRole('button', { name: /Single Photo/ }).press('Enter');
  await page.getByRole('button', { name: 'Timer off' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page).toHaveURL(/\/editor$/);

  const blackFrame = page.getByRole('button', { name: 'Black', exact: true });
  await page.getByRole('button', { name: 'Colors', exact: true }).click();
  await blackFrame.click();
  await page.getByRole('button', { name: 'Stickers', exact: true }).click();
  await page.getByRole('button', { name: '✨', exact: true }).click();

  const sticker = page.getByRole('button', { name: 'Select ✨ sticker' });
  const initial = await sticker.boundingBox();
  await sticker.press('ArrowRight');
  await expect.poll(async () => (await sticker.boundingBox()).x).toBeGreaterThan(initial.x + 5);

  const stickerPosition = () => sticker.evaluate((button) => {
    const element = button.parentElement;
    const strip = element.parentElement;
    return [
      element.offsetLeft / (strip.clientWidth - element.offsetWidth),
      element.offsetTop / (strip.clientHeight - element.offsetHeight),
    ];
  });
  const beforeDragPosition = await stickerPosition();
  const beforeDrag = await sticker.boundingBox();
  await page.mouse.move(beforeDrag.x + 10, beforeDrag.y + 10);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 50, beforeDrag.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await stickerPosition())[1]).toBeGreaterThan(beforeDragPosition[1]);

  const position = await stickerPosition();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 800 });
  const resizedPosition = await stickerPosition();
  expect(resizedPosition[0]).toBeCloseTo(position[0], 2);
  expect(resizedPosition[1]).toBeCloseTo(position[1], 2);
  await page.setViewportSize(viewport);

  const next = page.getByRole('button', { name: 'Next' });
  await next.click();
  const output = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  await expect(output).toHaveAttribute('src', /^data:image\/png;base64,/);
  const print = page.getByRole('button', { name: 'Print Photo' });
  await expect(print).toBeEnabled();

  const pixel = await output.evaluate((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [...context.getImageData(5, 5, 1, 1).data];
  });
  expect(pixel).toEqual([0, 0, 0, 255]);

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save to Device' }).click();
  expect((await download).suggestedFilename()).toBe('lumibooth-strip.png');
  await print.click();
  await expect(page.locator('html')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(output).toBeVisible();
  await expect(print).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(blackFrame).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(stickerPosition).toEqual(position);
  await next.click();
  await page.getByRole('button', { name: 'Finish Session' }).click();
  await expect(start).toBeVisible();
  await page.goBack();
  await expect(start).toBeVisible();
  await expect(output).toHaveCount(0);
});

test('a camera permission denial blocks capture and offers a working retry', async ({ page }) => {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    const getUserMedia = devices.getUserMedia.bind(devices);
    devices.getUserMedia = (constraints) => {
      if (!window.allowCamera) return Promise.reject(new DOMException('Test denial', 'NotAllowedError'));
      return getUserMedia(constraints);
    };
  });
  await page.goto('/layout');
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await expect(page.getByRole('status')).toContainText('Camera access was denied');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeDisabled();

  await page.evaluate(() => { window.allowCamera = true; });
  await page.getByRole('button', { name: 'Retry camera' }).click();
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page).toHaveURL(/\/editor$/);
});

test('an idle guest session closes and cannot be reopened from the editor URL', async ({ page }) => {
  await page.clock.install();
  await page.goto('/layout');
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await expect(page).toHaveURL(/\/camera$/);
  await page.clock.fastForward(5 * 60 * 1000 + 1000);
  const start = page.getByRole('link', { name: 'Start photo booth' });
  await expect(start).toBeVisible();
  await page.goto('/editor');
  await expect(start).toBeVisible();
});

test('all five layouts are offered and a three-photo strip exports the chosen template', async ({ page }) => {
  await page.goto('/layout');
  for (const count of [1, 2, 3, 4, 6]) {
    await expect(page.getByRole('button', { name: new RegExp(`\\b${count} photos?$`, 'i') })).toBeVisible();
  }

  await page.getByRole('button', { name: /Triple Strip/ }).click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  for (const count of [1, 2]) {
    await shutter.click();
    await expect(page.getByText(`${count} of 3 photos captured`)).toBeVisible();
  }
  await shutter.click();
  await expect(page.getByRole('img', { name: /Captured photo/ })).toHaveCount(3);
  await page.getByRole('button', { name: 'Soft Postcard' }).click();
  await expect(page.getByText('A LITTLE KEEPSAKE')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  const image = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  await expect(image).toBeVisible();
  const corner = await image.evaluate(async (strip) => {
    await strip.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.drawImage(strip, 5, 5, 1, 1, 0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
  expect(corner).toEqual([245, 228, 216, 255]);
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(page.getByRole('button', { name: 'Soft Postcard' })).toHaveAttribute('aria-pressed', 'true');
});
