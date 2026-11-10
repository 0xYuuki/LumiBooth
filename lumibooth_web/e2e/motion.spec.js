import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { decompressFrames, parseGIF } from 'gifuct-js';

async function openCamera(page, layout) {
  await page.addInitScript(() => {
    window.motionColor = '#ee1414';
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      const paint = () => {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = window.motionColor;
        context.fillRect(80, 0, 480, canvas.height);
      };
      paint();
      const stream = canvas.captureStream(30);
      setInterval(paint, 33);
      return stream;
    };
  });
  await page.goto('/layout');
  await page.getByRole('button', { name: layout }).click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled();
}

async function holdColor(page, color, duration) {
  await page.evaluate((color) => { window.motionColor = color; }, color);
  await page.waitForTimeout(duration);
}

async function readGif(locator) {
  return locator.evaluate(async (img) => {
    const response = await fetch(img.src);
    const decoder = new ImageDecoder({ data: await response.arrayBuffer(), type: 'image/gif' });
    await decoder.tracks.ready;
    const frames = decoder.tracks.selectedTrack.frameCount;
    const colors = [];
    let duration = 0;
    let dimensions;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    try {
      for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
        const { image } = await decoder.decode({ frameIndex });
        dimensions = [image.displayWidth, image.displayHeight];
        duration += image.duration;
        context.drawImage(image, 5, 5, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        colors.push(r > b && r > g ? 'red' : b > g ? 'blue' : 'green');
        image.close();
      }
      return { frames, colors, duration, dimensions };
    } finally {
      decoder.close();
    }
  });
}

test('quick consecutive motion shots keep five seconds each on the six-photo strip', async ({ page }) => {
  test.setTimeout(75000);
  await openCamera(page, /6-Grid Wide/);
  const toggle = page.getByRole('checkbox', { name: /Motion Photo/ });
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(toggle).toHaveCount(0);
  await shutter.click();
  await expect(page.getByText('1 of 6 photos captured')).toBeVisible();

  await holdColor(page, '#ee1414', 420);
  await shutter.click();
  await expect(page.getByText('1 of 6 photos captured')).toBeVisible();
  await expect(page.locator('.camera-countdown')).toHaveText(/^[12]$/, { timeout: 8000 });
  await holdColor(page, '#1414ee', 250);
  await expect(page.getByText('2 of 6 photos captured')).toBeVisible();
  await holdColor(page, '#14ee14', 300);
  await page.getByRole('button', { name: 'Timer off' }).click();
  await shutter.click();
  await expect(page.locator('.camera-countdown')).toHaveText(/^[12]$/, { timeout: 8000 });
  await holdColor(page, '#1414ee', 250);
  await expect(page.getByText('3 of 6 photos captured')).toBeVisible();

  await page.getByRole('button', { name: 'Timer: 3 seconds' }).click();
  await page.getByRole('button', { name: 'Timer: 5 seconds' }).click();
  await page.getByRole('button', { name: 'Timer: 10 seconds' }).click();
  for (const count of [4, 5]) {
    await shutter.click();
    await expect(page.getByText(`${count} of 6 photos captured`)).toBeVisible();
  }
  await shutter.click();

  await page.getByRole('button', { name: 'Tube TV' }).click();
  await page.getByRole('textbox', { name: 'Caption under LumiBooth (optional)' }).fill('Studio night');
  await page.getByRole('button', { name: 'Stickers', exact: true }).click();
  await page.getByRole('button', { name: '✨', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const motions = page.getByRole('region', { name: 'Motion photos' });
  await expect(motions.getByRole('listitem')).toHaveCount(6);
  for (const shot of [2, 3]) {
    await motions.getByRole('button', { name: `Play motion for shot ${shot}` }).click();
    const clip = await readGif(motions.getByRole('img', { name: `Motion from shot ${shot}` }));
    expect(clip.frames).toBeGreaterThan(16);
    expect(clip.frames).toBeLessThanOrEqual(40);
    expect(clip.duration).toBe(5_000_000);
    expect(clip.dimensions).toEqual([320, 240]);
    expect(clip.colors.at(-1)).toBe('blue');
    const [ownColor, otherColor] = shot === 2 ? ['red', 'green'] : ['green', 'red'];
    expect(clip.colors).toContain(ownColor);
    expect(clip.colors).not.toContain(otherColor);
  }

  const png = page.getByRole('img', { name: 'Your finished LumiBooth photo strip' });
  const still = await png.getAttribute('src');
  await page.getByRole('button', { name: 'Play strip' }).click();
  const strip = page.getByRole('group', { name: 'Animated LumiBooth photo strip' });
  await expect(strip.locator('.illustrated-overlay')).toHaveCount(6);
  await expect(strip.getByRole('img', { name: 'Captured photo 2' })).toHaveAttribute('src', /^blob:/);
  await expect(strip.getByRole('img', { name: 'Captured photo 3' })).toHaveAttribute('src', /^blob:/);
  await expect(strip.getByRole('img', { name: 'Captured photo 1' })).toHaveAttribute('src', /^blob:/);
  await expect(strip.getByText('Studio night')).toBeVisible();
  await expect(strip.locator('.sticker-visual')).toHaveCount(1);
  await expect(png).toHaveAttribute('src', still);
  await page.emulateMedia({ media: 'print' });
  await expect(strip).toBeHidden();
  await expect(png).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Stop strip' }).click();
  await expect(strip).toHaveCount(0);
  await page.getByRole('button', { name: 'Play strip' }).click();

  const savedStrip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save animated strip' }).click();
  const animation = await savedStrip;
  expect(animation.suggestedFilename()).toBe('lumibooth-motion-strip.gif');
  const bytes = await readFile(await animation.path());
  const exported = decompressFrames(parseGIF(new Uint8Array(bytes)), true);
  expect(exported).toHaveLength(40);
  expect(exported.reduce((duration, frame) => duration + frame.delay, 0)).toBe(5000);
  expect(exported[0].dims.width).toBeGreaterThan(320);
  const colorsAt = (frame, x, y) => [...frame.patch.slice(
    (frame.dims.width * y + x) * 4, (frame.dims.width * y + x) * 4 + 3,
  )];
  const { width, height } = exported[0].dims;
  const x = Math.floor(width * .68);
  const y = Math.floor(height * .16);
  const start = colorsAt(exported[0], x, y);
  const end = colorsAt(exported.at(-1), x, y);
  expect(start[0]).toBeGreaterThan(start[2]);
  expect(end[2]).toBeGreaterThan(end[0]);
  expect(colorsAt(exported[0], 5, 5)).toEqual(colorsAt(exported.at(-1), 5, 5));

  const download = page.waitForEvent('download');
  await motions.getByRole('button', { name: 'Save GIF for shot 2' }).click();
  expect((await download).suggestedFilename()).toBe('lumibooth-shot-2.gif');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(motions.getByText('Motion unavailable for this shot.')).toHaveCount(6);
  await expect(motions.getByRole('img')).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Your finished LumiBooth photo strip' })).toBeVisible();
});

test('an encoder failure still leaves a downloadable photo strip', async ({ page }) => {
  await page.addInitScript(() => {
    window.encoderAttempts = 0;
    window.Worker = class {
      constructor() {
        window.encoderAttempts++;
        throw new Error('Encoder unavailable');
      }
    };
  });
  await openCamera(page, /Single Photo/);
  await holdColor(page, '#1414ee', 400);
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Motion unavailable for this shot.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Save to Device' })).toHaveAttribute('download', 'lumibooth-strip.png');
  expect(await page.evaluate(() => window.encoderAttempts)).toBe(1);
});

test('a stalled motion buffer still saves the still after the countdown', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeInterval = window.setInterval.bind(window);
    window.setInterval = (callback, interval, ...args) => nativeInterval(
      callback, interval === 125 ? 60000 : interval, ...args,
    );
  });
  await openCamera(page, /Single Photo/);
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Motion unavailable for this shot.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Your finished LumiBooth photo strip' })).toBeVisible();
});
