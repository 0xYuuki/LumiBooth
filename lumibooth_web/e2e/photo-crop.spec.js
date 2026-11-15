import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test('photo crop exports the chosen region and persists through frames and review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  const bytes = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    for (const [index, color] of ['#ff0000', '#00ff00', '#0000ff'].entries()) {
      ctx.fillStyle = color; ctx.fillRect(index * 200, 0, 200, 200);
    }
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Choose image files').setInputFiles({ name: 'colors.png', mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') });
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  const zoom = page.getByRole('slider', { name: 'Zoom' });
  await zoom.fill('2');
  const aperture = page.getByRole('button', { name: 'Reposition photo' });
  const rendered = page.locator('.photo-strip .photo-aperture img');
  await aperture.focus();
  for (let i = 0; i < 12; i++) await aperture.press('ArrowRight');
  await expect(rendered).toHaveCSS('object-position', '0% 50%');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Colors', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await expect(zoom).toHaveValue('2');
  // Drag back toward the opposite edge.
  const box = await aperture.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(rendered).not.toHaveCSS('object-position', '0% 50%');
  for (let i = 0; i < 25; i++) await aperture.press('ArrowLeft');
  await expect(rendered).toHaveCSS('object-position', '100% 50%');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const point = await page.locator('.photo-strip .photo-aperture').evaluate((node) => {
    const cell = node.getBoundingClientRect(), strip = node.closest('.photo-strip').getBoundingClientRect();
    return [(cell.x + cell.width / 2 - strip.x) / strip.width, (cell.y + cell.height / 2 - strip.y) / strip.height];
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const output = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  const pixel = await output.evaluate(async (img, [x, y]) => {
    await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data];
  }, point);
  expect(pixel).toEqual([0, 0, 255, 255]);
  await page.getByRole('button', { name: 'Edit Strip' }).click();
  await page.getByRole('link', { name: 'Back to previous step' }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await expect(zoom).toHaveValue('2');
  await expect(rendered).toHaveCSS('object-position', '100% 50%');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(rendered).toHaveCSS('object-position', '100% 50%');
  await page.getByRole('button', { name: 'Reset crop' }).click();
  await expect(zoom).toHaveValue('1');
  await expect(rendered).toHaveCSS('object-position', '50% 50%');
});

test('mobile pinch zooms a photo without scrolling the adjustment surface', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  const photo = page.getByRole('button', { name: 'Reposition photo' });
  await photo.scrollIntoViewIfNeeded();
  const box = await photo.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y }, { x: x + 20, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 40, y }, { x: x + 40, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(page.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
});

test('animated export applies the same crop as the displayed strip', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      const paint = () => {
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 210, 480);
        ctx.fillStyle = '#00ff00'; ctx.fillRect(210, 0, 220, 480);
        ctx.fillStyle = '#0000ff'; ctx.fillRect(430, 0, 210, 480);
      };
      paint(); setInterval(paint, 33); return canvas.captureStream(30);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await page.getByRole('slider', { name: 'Zoom' }).fill('2');
  const photo = page.getByRole('button', { name: 'Reposition photo' });
  for (let i = 0; i < 12; i++) await photo.press('ArrowLeft');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const point = await page.locator('.photo-strip .photo-aperture').evaluate(node => {
    const cell = node.getBoundingClientRect(), strip = node.closest('.photo-strip').getBoundingClientRect();
    return [(cell.x + cell.width / 2 - strip.x) / strip.width, (cell.y + cell.height / 2 - strip.y) / strip.height];
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Play strip', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Animated LumiBooth photo strip' }).getByRole('img', { name: 'Captured photo 1' })).toHaveCSS('object-position', '100% 50%');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save animated strip', exact: true }).click();
  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const { parseGIF, decompressFrames } = await import('gifuct-js');
  const frames = decompressFrames(parseGIF(new Uint8Array(await readFile(await download.path()))), true);
  expect(frames.length).toBeGreaterThan(1);
  for (const frame of [frames[0], frames.at(-1)]) {
    const offset = (Math.floor(point[1] * frame.dims.height) * frame.dims.width + Math.floor(point[0] * frame.dims.width)) * 4;
    const [r, g, b] = frame.patch.slice(offset, offset + 3);
    expect(b).toBeGreaterThan(230); expect(r).toBeLessThan(25); expect(g).toBeLessThan(25);
  }
});

test('tap-to-edit shows full bounds and four usable corner handles without a Photos tab', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('link', { name: 'Take photos', exact: true }).click();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await expect(page.getByRole('button', { name: 'Photos', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Adjust captured photo 1' }).click();
  await expect(page.getByRole('img', { name: 'Full original photo' })).toBeVisible();
  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    const handle = page.getByRole('button', { name: `Resize photo ${corner}` });
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
  const handle = await page.getByRole('button', { name: 'Resize photo top-left' }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down(); await page.mouse.move(handle.x - 25, handle.y - 25, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => Number(await page.getByRole('slider', { name: 'Zoom' }).inputValue())).toBeGreaterThan(1);
  const window = page.locator('.transform-window');
  const before = await window.boundingBox();
  const image = await page.getByRole('button', { name: 'Reposition photo' }).boundingBox();
  await page.mouse.move(image.x + image.width / 2, image.y + image.height / 2);
  await page.mouse.down(); await page.mouse.move(image.x + image.width / 2 + 15, image.y + image.height / 2, { steps: 4 }); await page.mouse.up();
  const after = await window.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 1); expect(after.y).toBeCloseTo(before.y, 1);
  await page.getByRole('button', { name: 'Reset crop' }).click();
  await expect(page.getByRole('slider', { name: 'Zoom' })).toHaveValue('1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
