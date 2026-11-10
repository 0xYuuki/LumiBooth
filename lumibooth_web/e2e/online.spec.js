import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const origin = 'https://lumi-test.invalid';
const roomId = '0b18d061-af3e-41bf-8d83-eb36f23240f9';
const invite = 'a'.repeat(48);
const replay = 'b'.repeat(48);
const expiry = '2027-02-08T12:00:00Z';

test.skip(process.env.VITE_LUMI_SUPABASE_URL !== origin, 'Run against the online test build.');

async function mockClient(context, role, api, files, network) {
  let syncCount = 0;
  await context.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    };
    const respond = (json, status = 200) => route.fulfill({ status, json, headers });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/v1/signup') {
      const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: role })).toString('base64url');
      return respond({
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fake`,
        refresh_token: role, expires_in: 3600,
        user: { id: role, aud: 'authenticated', role: 'authenticated' },
      });
    }
    if (url.pathname === '/functions/v1/lumi') {
      const body = request.postDataJSON();
      const sync = network && body.action === 'room_sync';
      if (sync) await sleep(network.outbound);
      const result = api(body, role);
      if (sync) await sleep(network.inbound + (++syncCount % 4 === 0 ? 100 : 0));
      return respond(result, result.error ? 409 : 200);
    }
    if (request.method() === 'PUT' && url.pathname.includes('/upload/sign/')) {
      const path = decodeURIComponent(url.pathname.split('/lumi-media/')[1]);
      const contentType = request.headers()['content-type'];
      const bytes = request.postDataBuffer();
      const file = contentType.startsWith('multipart/')
        ? (await new Response(bytes, { headers: { 'content-type': contentType } }).formData()).get('')
        : new Blob([bytes], { type: contentType });
      files.set(path, { contentType: file.type, body: Buffer.from(await file.arrayBuffer()) });
      return respond({ Key: `lumi-media/${path}` });
    }
    if (url.pathname.startsWith('/asset/')) {
      const file = files.get(decodeURIComponent(url.pathname.slice(7)));
      return file ? route.fulfill({ ...file, headers }) : respond({ error: 'No file' }, 404);
    }
    return respond({ error: 'Unknown test request' }, 404);
  });
  await context.addInitScript((color) => {
    window.prints = [];
    window.shutters = [];
    window.cameraColor = color;
    window.print = () => window.prints.push(Boolean(document.querySelector('.print-play-qr img')));
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, mime, quality) {
      if (mime === 'image/jpeg') window.shutters.push(Date.now());
      return toBlob.call(this, callback, mime, quality);
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      function paint() {
        context.fillStyle = window.cameraColor;
        context.fillRect(0, 0, 480, 360);
        context.fillStyle = '#ffffff';
        context.fillRect(Date.now() % 400, 150, 24, 24);
      }
      paint();
      setInterval(paint, 33);
      return canvas.captureStream(30);
    };
  }, role === 'host' ? '#cc2244' : '#3355cc');
}

const ticket = (path) => ({ path, token: 'mock-ticket' });
const asset = (path) => `${origin}/asset/${encodeURIComponent(path)}`;

test('the QR gallery is opt-in and lets a different guest download all outputs', async ({ browser, context, page, baseURL }) => {
  test.setTimeout(40000);
  const files = new Map();
  const actions = [];
  let published = false;
  function api({ action, token, originals, hasMotion }) {
    actions.push(action);
    if (action === 'share_begin') {
      expect(originals).toBe(1);
      expect(hasMotion).toBe(true);
      return { id: roomId, token: replay, poster: ticket('poster.png'), motion: ticket('motion.gif'), originals: [ticket('original-1.jpg')] };
    }
    if (action === 'share_publish') {
      published = files.has('poster.png') && files.has('motion.gif') && files.has('original-1.jpg');
      return published ? { expiresAt: expiry } : { error: 'Missing media' };
    }
    if (action === 'share_resolve' && token === replay && published) {
      return { poster: asset('poster.png'), motion: asset('motion.gif'), originals: [asset('original-1.jpg')], expiresAt: expiry };
    }
    if (action === 'share_revoke') { published = false; return { ok: true }; }
    return { error: 'This strip has expired or was removed.' };
  }
  await mockClient(context, 'host', api, files);
  await page.goto('/layout');
  await page.getByRole('button', { name: /Single Photo/ }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Tube TV' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Print Photo', exact: true }).click();
  expect(actions).toEqual([]);
  await page.getByRole('button', { name: 'Share with QR' }).click();
  expect(actions).toEqual([]);
  await page.getByRole('button', { name: 'Upload and show QR' }).click();
  await expect(page.getByRole('img', { name: 'Scan to download photos' })).toBeVisible({ timeout: 20000 });
  const galleryUrl = await page.getByRole('link', { name: 'Open photo gallery' }).getAttribute('href');
  await page.getByRole('button', { name: 'Print with QR' }).click();
  await expect(page.getByRole('img', { name: 'Photo gallery QR code' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.prints)).toEqual([false, true]);
  expect(actions.filter((action) => action === 'share_begin')).toHaveLength(1);
  expect(files.get('motion.gif').body.subarray(0, 6).toString()).toBe('GIF89a');

  const recipient = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    await mockClient(recipient, 'recipient', api, files);
    const viewer = await recipient.newPage();
    await viewer.goto(galleryUrl);
    await expect(viewer.getByRole('img', { name: 'Finished LumiBooth strip' })).toBeVisible();
    await expect(viewer.getByRole('img', { name: 'Original photo 1' })).toBeVisible();
    await viewer.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(viewer.getByRole('img', { name: 'Animated LumiBooth strip' })).toHaveAttribute('src', /motion\.gif$/);
    for (const [button, filename, assetName] of [
      ['Download photo 1', 'lumibooth-photo-1.jpg', 'original-1.jpg'],
      ['Download finished strip', 'lumibooth-strip.png', 'poster.png'],
      ['Download animated strip', 'lumibooth-motion-strip.gif', 'motion.gif'],
    ]) {
      const saving = viewer.waitForEvent('download', { timeout: 10000 });
      await viewer.getByRole('button', { name: button }).click();
      const download = await saving;
      expect(download.suggestedFilename()).toBe(filename);
      expect(await readFile(await download.path())).toEqual(files.get(assetName).body);
    }
    await page.getByRole('button', { name: 'Revoke link' }).click();
    await expect(page.getByRole('button', { name: 'Revoke link' })).toHaveCount(0);
    await viewer.reload();
    await expect(viewer.getByRole('alert')).toContainText('expired or was removed');
  } finally {
    await recipient.close();
  }
});

test('two guests on simulated different networks capture an ordered, identical strip', async ({ browser, baseURL }) => {
  test.setTimeout(65000);
  const hostContext = await browser.newContext({ baseURL });
  const guestContext = await browser.newContext({ baseURL });
  const files = new Map();
  const room = { id: roomId, state: 'waiting', round: 1, revision: 0, attempt: null, hostReady: false, guestReady: false };
  const shots = new Set();
  const colors = [
    ['#d32f48', '#ddb334'],
    ['#31b35a', '#bd4bb8'],
    ['#2864c6', '#27b6bd'],
  ];
  const snapshot = (role) => ({ ...room, role, serverNow: Date.now(), submitted: shots.has(`${room.round}-${role}`) });
  function api(input, role) {
    switch (input.action) {
      case 'room_begin': return { id: roomId, invite };
      case 'room_join':
        if (input.token !== invite || room.state !== 'waiting') return { error: 'Invalid invite' };
        room.state = 'capture';
        room.revision++;
        return { id: roomId };
      case 'room_sync':
        if (room.state === 'capture' && room.round === input.round && typeof input.ready === 'boolean') {
          room[`${role}Ready`] = input.ready;
        }
        return {
          ...snapshot(role),
          photos: input.assets && room.state === 'design' ? [1, 2, 3].flatMap((n) => ['host', 'guest'].map((who) => asset(`${n}-${who}.jpg`))) : undefined,
          poster: input.assets && room.state === 'complete' ? asset('shared.png') : undefined,
        };
      case 'room_start':
        if (!room.hostReady || !room.guestReady || room.attempt) return { error: 'Both guests must be ready' };
        room.attempt = `round-${room.round}`;
        room.shutterAt = Date.now() + 5000;
        room.revision++;
        return snapshot(role);
      case 'room_upload':
        return ticket(`${room.round}-${role}.jpg`);
      case 'room_shot':
        if (!files.has(`${room.round}-${role}.jpg`)) return { error: 'Missing shot' };
        shots.add(`${room.round}-${role}`);
        if (shots.has(`${room.round}-host`) && shots.has(`${room.round}-guest`)) {
          if (room.round === 3) room.state = 'design'; else room.round++;
          room.attempt = null;
          room.hostReady = room.guestReady = false;
        }
        room.revision++;
        return snapshot(role);
      case 'room_prepare_final': return { ...ticket('shared.png'), asset: roomId };
      case 'room_finish':
        if (!files.has('shared.png')) return { error: 'Missing strip' };
        room.state = 'complete';
        room.revision++;
        return snapshot(role);
      default: return { error: 'Unexpected action' };
    }
  }
  try {
    await mockClient(hostContext, 'host', api, files, { outbound: 20, inbound: 35 });
    await mockClient(guestContext, 'guest', api, files, { outbound: 95, inbound: 35 });
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await host.goto('/room');
    await host.getByRole('button', { name: 'Agree and create room' }).click();
    const link = host.getByRole('textbox', { name: 'Invite link' });
    await expect(link).toHaveValue(new RegExp(`/room#${invite}$`));
    await guest.goto(await link.inputValue());
    await guest.getByRole('button', { name: 'Agree and join' }).click();
    for (let round = 1; round <= 3; round++) {
      for (const [column, page] of [host, guest].entries()) {
        await expect(page.getByText(new RegExp(`Round ${round} of 3`))).toBeVisible({ timeout: 12000 });
        await page.evaluate((color) => { window.cameraColor = color; }, colors[round - 1][column]);
        await page.getByRole('button', { name: 'I’m ready' }).click();
      }
      await host.getByRole('button', { name: 'Start countdown' }).click();
      try {
        await expect.poll(() => shots.size, { timeout: 12000 }).toBe(round * 2);
      } catch (error) {
        const clients = await Promise.all([host, guest].map((page) => page.evaluate(() => ({
          hidden: document.hidden,
          cameraRequests: window.shutters,
          status: document.querySelector('main')?.innerText,
        }))));
        await test.info().attach('capture state', { body: JSON.stringify({ room, clients }, null, 2), contentType: 'application/json' });
        throw error;
      }
    }
    const [hostShutters, guestShutters] = await Promise.all([host, guest].map((page) => page.evaluate(() => window.shutters)));
    expect(hostShutters).toHaveLength(3);
    expect(guestShutters).toHaveLength(3);
    const offsets = hostShutters.map((time, index) => Math.abs(time - guestShutters[index]));
    console.log(`Simulated shutter request gaps: ${offsets.join(', ')} ms`);
    for (const offset of offsets) expect(offset).toBeLessThanOrEqual(250);
    await host.getByRole('button', { name: 'Design your shared strip' }).click();
    const windows = host.locator('.photo-strip .illustrated-window');
    await expect(windows).toHaveCount(3);
    await expect(host.getByRole('button', { name: 'Tube TV' })).toHaveAttribute('aria-pressed', 'true');
    await expect(host.getByLabel('Caption under LumiBooth (optional)')).toHaveValue('MILES APART, SAME MOMENT');
    await host.getByRole('button', { name: 'Templates', exact: true }).click();
    await host.getByRole('button', { name: 'Studio', exact: true }).click();
    await expect(host.locator('.photo-strip .paired-photo-cell')).toHaveCount(3);
    await host.getByRole('button', { name: 'Illustrated', exact: true }).click();
    await host.getByRole('button', { name: 'Tube TV' }).click();
    for (let row = 0; row < 3; row++) {
      await expect(windows.nth(row).getByRole('img', { name: `Round ${row + 1}, host photo` })).toBeVisible();
      await expect(windows.nth(row).getByRole('img', { name: `Round ${row + 1}, guest photo` })).toBeVisible();
    }
    const cells = windows.getByRole('img');
    await expect(cells).toHaveCount(6);
    const points = await cells.evaluateAll((photos) => photos.map((photo) => {
      const strip = photo.closest('.photo-strip').getBoundingClientRect();
      const box = photo.getBoundingClientRect();
      return [(box.left + box.width / 2 - strip.left) / strip.width,
        (box.top + box.height / 2 - strip.top) / strip.height];
    }));
    for (let row = 0; row < 3; row++) {
      const [left, right] = points.slice(row * 2, row * 2 + 2);
      expect(left[0]).toBeLessThan(right[0]);
      expect(left[1]).toBeCloseTo(right[1]);
      if (row > 0) expect(left[1]).toBeGreaterThan(points[row * 2 - 2][1]);
    }
    await host.getByRole('button', { name: 'Next' }).click();
    await host.getByRole('button', { name: 'Send strip to friend' }).click();
    await expect.poll(() => files.has('shared.png')).toBe(true);
    const final = files.get('shared.png').body;
    for (const page of [host, guest]) {
      await page.getByRole('button', { name: 'Open your shared strip' }).click();
      const strip = page.getByRole('img', { name: 'Your finished shared strip' });
      await expect(strip).toBeVisible();
      const pixels = await strip.evaluate(async (image, points) => {
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return points.map(([x, y]) => [...context.getImageData(
          Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1,
        ).data].slice(0, 3));
      }, points);
      for (const [index, color] of colors.flat().entries()) {
        const expected = Buffer.from(color.slice(1), 'hex');
        for (const [channel, value] of pixels[index].entries()) {
          expect(Math.abs(value - expected[channel]), `photo slot ${index + 1}, channel ${channel}`).toBeLessThan(20);
        }
      }
      const saving = page.waitForEvent('download', { timeout: 10000 });
      await page.getByRole('button', { name: 'Save shared strip' }).click();
      const downloaded = await saving;
      expect(await readFile(await downloaded.path())).toEqual(final);
    }
    expect(final.subarray(1, 4).toString()).toBe('PNG');
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close()]);
  }
});
