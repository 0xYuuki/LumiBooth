import { expect, test } from '@playwright/test';

test('a guest can capture, decorate, download, and finish a private session', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
    };
  });

  await page.goto('/preview');
  const start = page.getByRole('button', { name: 'Create photo strip' });
  await expect(start).toBeVisible();
  await start.press('Enter');
  await expect(page).toHaveURL(/\/gallery$/);
  const singlePhoto = page.getByRole('button', { name: /Single Photo/ });
  await expect(singlePhoto).toBeVisible();
  await singlePhoto.press('Enter');
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await expect(page).toHaveURL(/\/camera$/);
  const timer = page.getByRole('button', { name: 'Timer off' });
  await expect(timer).toBeVisible();
  await timer.click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page).toHaveURL(/\/gallery$/);
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page).toHaveURL(/\/editor$/);

  const blackFrame = page.getByRole('button', { name: 'Black', exact: true });
  await page.getByLabel('Frame category', { exact: true }).selectOption('Colors');
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
  await page.mouse.move(beforeDrag.x + beforeDrag.width / 2, beforeDrag.y + beforeDrag.height / 2);
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
  await page.getByRole('button', { name: 'Back to home' }).click();
  await expect(page.getByRole('link', { name: 'Continue your strip' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue your strip' }).click();
  await expect(page.locator('.gallery-import-card')).toHaveCount(1);
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Camera access was denied');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeDisabled();

  await page.evaluate(() => { window.allowCamera = true; });
  await page.getByRole('button', { name: 'Retry camera' }).click();
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page).toHaveURL(/\/gallery$/);
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page).toHaveURL(/\/editor$/);
});

test('Home preserves the draft and starting fresh requires confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await page.getByRole('link', { name: 'Continue your strip' }).click();
  await expect(page.getByRole('button', { name: /Dual Strip/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'LumiBooth home' }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.getByRole('link', { name: 'Continue your strip' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.getByRole('button', { name: /Triple Strip/ })).toHaveAttribute('aria-pressed', 'true');
});

test('all five layouts are offered and a three-photo strip exports the chosen template', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  for (const count of [1, 2, 3, 4, 6]) {
    await expect(page.getByRole('button', { name: new RegExp(`\\b${count} photos?$`, 'i') })).toBeVisible();
  }

  await page.getByRole('button', { name: /Triple Strip/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  for (const count of [1, 2]) {
    await shutter.click();
    await expect(page.getByText(`${count} of 3 photos captured`)).toBeVisible();
  }
  await shutter.click();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByRole('img', { name: /Captured photo/ })).toHaveCount(3);
  const gallery = page.locator('.frame-gallery');
  await page.getByLabel('Frame category', { exact: true }).selectOption('Templates');
  await expect(gallery.getByRole('button')).toHaveCount(14);
  for (const name of ['Classic White', 'Retro Flash', 'Wedding Ivory', 'Birthday Confetti']) {
    await expect(gallery.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await gallery.getByRole('button', { name: 'Retro Flash' }).click();
  await expect(page.getByText('GOOD TIMES · PHOTO BOOTH')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  const image = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  await expect(image).toBeVisible();
  const checkerColors = await image.evaluate(async (strip) => {
    await strip.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 10;
    const context = canvas.getContext('2d');
    context.drawImage(strip, 0, 0);
    return [6, 42].map((x) => [...context.getImageData(x, 6, 1, 1).data]);
  });
  expect(checkerColors).toEqual(expect.arrayContaining([
    [244, 211, 141, 255],
    [169, 70, 55, 255],
  ]));
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(gallery.getByRole('button', { name: 'Retro Flash' })).toHaveAttribute('aria-pressed', 'true');
});

test('a fixed camera crop fits both portrait and illustrated frame exports', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      context.fillStyle = '#0000ff';
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = '#ffff00';
      context.fillRect(80, 0, 480, 360);
      context.fillStyle = '#00ff00';
      context.fillRect(150, 0, 340, 360);
      return canvas.captureStream();
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  const camera = page.locator('.camera-video');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(shutter).toBeEnabled();
  const { width, height } = await camera.boundingBox();
  expect(width / height).toBeCloseTo(4 / 3);
  await shutter.click();
  await page.getByRole('button', { name: 'Continue to design' }).click();

  const photo = page.locator('.editor-preview-fit').getByRole('img', { name: 'Captured photo 1' });
  await expect(photo).toBeVisible();
  const capture = await photo.evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return {
      size: [image.naturalWidth, image.naturalHeight],
      edge: [...context.getImageData(8, 8, 1, 1).data],
    };
  });
  expect(capture.size).toEqual([480, 360]);
  expect(capture.edge[0]).toBeGreaterThan(230);
  expect(capture.edge[1]).toBeGreaterThan(230);
  expect(capture.edge[2]).toBeLessThan(25);

  async function exportEdge() {
    await page.evaluate(() => document.fonts.ready);
    let point;
    await expect.poll(async () => {
      point = await photo.evaluate((image) => {
        const slot = image.getBoundingClientRect();
        const strip = image.closest('.photo-strip').getBoundingClientRect();
        if (!slot.width || !slot.height || !strip.width || !strip.height) return null;
        return [(slot.left - strip.left + .06 * slot.width) / strip.width,
          (slot.top - strip.top + .5 * slot.height) / strip.height];
      });
      return point?.every(value => Number.isFinite(value) && value > 0 && value < 1);
    }).toBe(true);
    await page.getByRole('button', { name: 'Next' }).click();
    return page.getByRole('img', { name: 'Your finished LumiBooth photo strip' }).evaluate(async (image, [x, y]) => {
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return [...context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data];
    }, point);
  }

  const portrait = await exportEdge();
  expect(portrait[0]).toBeLessThan(25);
  expect(portrait[1]).toBeGreaterThan(230);
  expect(portrait[3]).toBe(255);
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await page.getByRole('button', { name: 'Tube TV' }).click();
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  const tube = await exportEdge();
  expect(tube[0]).toBeGreaterThan(230);
  expect(tube[1]).toBeGreaterThan(230);
  expect(tube[2]).toBeLessThan(25);
  expect(tube[3]).toBe(255);
});

test('illustrated frames put captured photos inside the artwork and export the overlay', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Dual Strip/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await shutter.click();
  await expect(page.getByText('1 of 2 photos captured')).toBeVisible();
  await shutter.click();
  await page.getByRole('button', { name: 'Continue to design' }).click();

  const gallery = page.locator('.frame-gallery');
  await expect(gallery.getByRole('button')).toHaveCount(5);
  await gallery.getByRole('button', { name: 'Camera Film' }).click();
  await expect(page.locator('.photo-strip .illustrated-header')).toBeVisible();
  await expect(page.locator('.photo-strip .illustrated-window img')).toHaveCount(2);
  await gallery.getByRole('button', { name: 'Tube TV' }).click();
  await expect(page.locator('.photo-strip .illustrated-overlay')).toHaveCount(2);
  await expect(page.getByText('NOW ON AIR')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  const output = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  await expect(output).toHaveAttribute('src', /^data:image\/png;base64,/);
  const colors = await output.evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [[6, 6], [505, 223], [279, 234]].map(([x, y]) =>
      [...context.getImageData(x, y, 1, 1).data]);
  });
  expect(colors[0]).toEqual([229, 209, 173, 255]);
  expect(colors[1]).not.toEqual(colors[0]);
  expect(colors[1]).not.toEqual(colors[2]);
});

test('an image sticker can be dragged, resized, rotated, and exported', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ead7ad';
      const draw = () => context.fillRect(0, 0, canvas.width, canvas.height);
      draw();
      const stream = canvas.captureStream(15);
      const timer = setInterval(draw, 60);
      stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
      return stream;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();

  const next = page.getByRole('button', { name: 'Next' });
  const strip = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  await next.click();
  await expect(strip).toHaveAttribute('src', /^data:image\/png;base64,/);
  const original = await strip.getAttribute('src');

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await page.getByRole('button', { name: 'Stickers', exact: true }).click();
  const packs = page.getByLabel('Sticker pack');
  await expect(packs.getByRole('option')).toHaveCount(8);
  await packs.selectOption('costume-props');
  await page.getByRole('button', { name: 'Black glasses', exact: true }).click();
  const placed = page.getByRole('button', { name: 'Select Black glasses sticker' });
  await expect(placed).toBeVisible();
  const before = await placed.boundingBox();
  const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: center.x + 36, y: center.y + 40 }],
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect.poll(async () => (await placed.boundingBox()).x).toBeGreaterThan(before.x + 25);

  const previewScale = await page.locator('.photo-strip').evaluate(node => node.getBoundingClientRect().width / node.clientWidth);
  const resize = await page.getByRole('button', { name: 'Resize sticker' }).boundingBox();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width / 2 + 48 * previewScale, resize.y + resize.height / 2 + 48 * previewScale, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('slider', { name: 'Sticker size' })).toHaveValue('120');

  const rotate = await page.getByRole('button', { name: 'Rotate sticker' }).boundingBox();
  const resized = await placed.boundingBox();
  const rotateCenterX = resized.x + resized.width / 2;
  const rotateCenterY = resized.y + resized.height / 2;
  const rotateStartX = rotate.x + rotate.width / 2;
  const rotateStartY = rotate.y + rotate.height / 2;
  await page.mouse.move(rotateStartX, rotateStartY);
  await page.mouse.down();
  await page.mouse.move(rotateCenterX - (rotateStartY - rotateCenterY), rotateCenterY + (rotateStartX - rotateCenterX), { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('slider', { name: 'Sticker rotation' })).toHaveValue('90');

  await next.click();
  await expect(strip).toHaveAttribute('src', /^data:image\/png;base64,/);
  const changedPixels = await strip.evaluate(async (output, baseline) => {
    const originalImage = new Image();
    originalImage.src = baseline;
    await Promise.all([output.decode(), originalImage.decode()]);
    const canvas = document.createElement('canvas');
    canvas.width = output.naturalWidth;
    canvas.height = output.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(originalImage, 0, 0);
    const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.drawImage(output, 0, 0);
    const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let left = canvas.width;
    let top = canvas.height;
    let right = 0;
    let bottom = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (after[i] < 30 && after[i + 1] < 30 && after[i + 2] < 30 && before[i] - after[i] > 25) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor(i / 4 / canvas.width);
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        count++;
      }
    }
    return { count, width: right - left, height: bottom - top };
  }, original);
  expect(changedPixels.count).toBeGreaterThan(100);
  expect(changedPixels.height).toBeGreaterThan(changedPixels.width * 2);

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(placed.locator('..').locator('.sticker-visual')).toHaveAttribute('style', /rotate\(90deg\)/);
  await expect(placed).toHaveCSS('width', '120px');
});

test('the strip caption can be edited, hidden, and restored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();

  const field = page.getByRole('textbox', { name: 'Caption under LumiBooth (optional)' });
  const caption = page.locator('.strip-caption');
  await expect(field).toHaveValue('THE PHOTO BOOTH');
  await field.fill('123456789012345678901234567890123456');
  await expect(field).toHaveValue('12345678901234567890123456789012');
  await field.fill('Manila memories');
  await expect(caption).toHaveText('Manila memories');
  await page.getByRole('button', { name: 'Tube TV' }).click();
  await expect(caption).toHaveText('Manila memories');

  const next = page.getByRole('button', { name: 'Next' });
  const output = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  const title = page.locator('.strip-signature strong');
  const font = page.getByLabel('Strip font');
  await next.click();
  await expect(output).toHaveAttribute('src', /^data:image\/png;base64,/);
  const defaultFontPng = await output.getAttribute('src');

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await font.selectOption('Playfair Display');
  await expect(title).toHaveCSS('font-family', /Playfair Display/);
  await expect(caption).toHaveCSS('font-family', /Playfair Display/);
  const loadedFaces = await page.evaluate(async () =>
    (await document.fonts.load('400 14px "Playfair Display"')).length);
  expect(loadedFaces).toBeGreaterThan(0);
  await next.click();
  await expect(output).toHaveAttribute('src', /^data:image\/png;base64,/);
  const withCaption = await output.getAttribute('src');
  expect(withCaption).not.toEqual(defaultFontPng);

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(field).toHaveValue('Manila memories');
  await expect(font).toHaveValue('Playfair Display');
  await page.getByRole('button', { name: 'Remove caption' }).click();
  await expect(caption).toHaveText('');
  await expect(page.locator('.strip-signature strong')).toHaveText('LumiBooth');
  await next.click();
  await expect(output).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(await output.getAttribute('src')).not.toEqual(withCaption);

  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await expect(field).toHaveValue('');
  await page.getByRole('button', { name: 'Use frame caption' }).click();
  await expect(caption).toHaveText('NOW ON AIR');
  await expect(title).toHaveCSS('font-family', /Playfair Display/);
  await expect(caption).toHaveCSS('font-family', /Playfair Display/);
});
