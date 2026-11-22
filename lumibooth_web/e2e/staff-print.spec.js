import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const backend = 'https://lumi-test.invalid';
const staffUrl = 'http://127.0.0.1:4187/';
const enabled = process.env.LUMI_TEST_STAFF === 'true' && process.env.VITE_LUMI_COMMERCE === 'true' && process.env.VITE_LUMI_SUPABASE_URL === backend;
const requestId = 'ad2f6ba9-d537-4ce5-9970-f90bff01ca35';
const userId = '459e9da1-de85-40b4-ac8d-e58341dfbaa6';
const code = 'PS-0123456789AB';
const createdAt = '2030-12-01T10:00:00Z';
const specification = {
  title: 'Test strip', sku: 'test-strip', variant: 'Gloss', width_px: 240, height_px: 360,
  target_dpi: 300, bleed_px: 12, safe_inset_px: 8,
};

async function mockStaff(page, handle) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const claim = Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiJ9.${claim}.fake`;
  await page.addInitScript(session => {
    if (!localStorage.getItem('lumibooth-account')) localStorage.setItem('lumibooth-account', JSON.stringify(session));
  }, { access_token: token, refresh_token: 'staff', expires_at: exp, expires_in: 3600,
    user: { id: userId, email: 'staff@example.test', is_anonymous: false } });
  await page.route(`${backend}/**`, async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(request.headers().authorization).toBe(`Bearer ${token}`);
    return handle(new URL(request.url()).pathname.split('/').at(-1), request.postDataJSON(), {
      json: (json, status = 200) => route.fulfill({ status, json, headers }),
      png: () => route.fulfill({ contentType: 'image/png', headers, body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXRsAAAAASUVORK5CYII=', 'base64',
      ) }),
    });
  });
}

test('staff queue requires an account and an active staff role', async ({ page }) => {
  test.skip(!enabled, 'Requires the commerce browser test build.');
  await page.goto(staffUrl);
  await expect(page).toHaveURL(`${staffUrl}account`);
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Print orders', exact: true })).toHaveCount(0);
  await mockStaff(page, (action, _body, reply) => {
    expect(action).toBe('staff-list');
    return reply.json({ error: 'Forbidden' }, 403);
  });
  await page.goto(staffUrl);
  await expect(page.getByRole('alert')).toHaveText('An active staff role is required to access print orders.');
  await expect(page.getByRole('region', { name: 'Print queue' })).toHaveCount(0);
});

test('staff verifies a purchase on mobile, previews its original and records shipping', async ({ page }) => {
  test.skip(!enabled, 'Requires the commerce browser test build.');
  await page.setViewportSize({ width: 390, height: 844 });
  let status = 'awaiting_marketplace_order';
  let mediaCalls = 0;
  let match = null;
  let trackingReference = null;
  let filter;
  const request = () => ({ requestId, status, code, createdAt, specification, quantity: 1,
    orderId: match?.order_id, trackingReference });
  await mockStaff(page, (action, body, reply) => {
    switch (action) {
      case 'staff-list':
        filter = body.lookup ?? filter;
        return reply.json({ requests: [request()] });
      case 'staff-detail':
        expect(body.requestId).toBe(requestId);
        return reply.json({ request: request(), match, fileStatus: match ? 'ready' : 'locked', reprints: [], events: [] });
      case 'staff-match':
        expect(body).toMatchObject({ code, orderId: 'TEST-123', lineId: null, sku: 'test-strip', variant: 'Gloss',
          shippingDeadline: null, lineQuantity: 1, firstUnit: 1, sellerCenterVerified: true });
        status = 'verified';
        match = { order_id: body.orderId, allocation_start: 1, verified_line_quantity: 1, verified_at: createdAt };
        return reply.json(request());
      case 'staff-media':
        expect(match).toBeTruthy();
        expect(body.requestId).toBe(requestId);
        mediaCalls++;
        return reply.png();
      case 'staff-transition':
        expect(body.requestId).toBe(requestId);
        expect(body.expectedStatus).toBe(status);
        status = body.status;
        trackingReference = body.trackingReference;
        return reply.json(request());
      default:
        return reply.json({ error: 'Unexpected test request' }, 500);
    }
  });
  await page.goto(staffUrl);
  await page.getByLabel('Reference or order ID').fill(code);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect.poll(() => filter).toBe(code);
  await page.getByRole('button', { name: new RegExp(code) }).click();
  await expect(page.getByText(/The private print file is locked/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download print PNG' })).toHaveCount(0);
  await page.getByLabel('TikTok order ID').fill('TEST-123');
  await page.getByLabel('Purchased SKU').fill('test-strip');
  await page.getByLabel('Purchased variant').fill('Gloss');
  await page.getByLabel('Quantity on order line').fill('1');
  await page.getByRole('button', { name: 'Verify and match purchase' }).click();
  expect(match).toBeNull();
  expect(mediaCalls).toBe(0);
  await page.getByLabel(/I verified the purchase/).check();
  await page.getByRole('button', { name: 'Verify and match purchase' }).click();
  await page.getByRole('button', { name: 'Load preview' }).click();
  await expect(page.getByRole('img', { name: 'Verified print file' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download print PNG' }).click();
  expect((await download).suggestedFilename()).toBe(`lumibooth-${code}.png`);
  for (const name of ['Release to print queue', 'Start printing', 'Mark packed']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.getByLabel('Waybill or tracking reference (optional)').fill('TEST-TRACK-01');
  await page.getByRole('button', { name: 'Record shipment' }).click();
  await expect(page.getByText('TEST-TRACK-01')).toBeVisible();
});


test('the public booth has no staff print queue', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Staff Print Orders' })).toHaveCount(0);
  await page.goto('/admin/print-orders');
  await expect(page.getByText('Page unavailable')).toBeVisible();
});


test('staff login opens the queue directly and sign-out protects it again', async ({ page }) => {
  test.skip(!enabled, 'Requires the commerce browser test build.');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url')}.fake`;
  let queueCalls = 0;
  await page.route(`${backend}/**`, async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, GET, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    if (path === '/auth/v1/token') return route.fulfill({ headers, json: {
      access_token: token, refresh_token: 'staff', expires_in: 3600,
      user: { id: userId, email: 'staff@example.test', is_anonymous: false },
    } });
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/staff-list')) {
      queueCalls++;
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      return route.fulfill({ headers, json: { requests: [] } });
    }
    return route.fulfill({ status: 404, headers, json: { error: 'Unexpected request' } });
  });
  await page.goto(staffUrl);
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  expect(queueCalls).toBe(0);
  await expect(page.getByRole('button', { name: 'Create an account' })).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(staffUrl);
  await expect(page.getByRole('heading', { name: 'Your queue is clear' })).toBeVisible();
  await page.getByRole('link', { name: 'Staff account' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  const previousCalls = queueCalls;
  await page.goto(staffUrl);
  await expect(page).toHaveURL(`${staffUrl}account`);
  await expect(page.getByRole('heading', { name: 'Print orders', exact: true })).toHaveCount(0);
  expect(queueCalls).toBe(previousCalls);
});


test('dashboard recovers from connection errors and clears filters on mobile', async ({ page }, testInfo) => {
  test.skip(!enabled, 'Requires the commerce browser test build.');
  let unavailable = true;
  const calls = [];
  await mockStaff(page, (action, body, reply) => {
    expect(action).toBe('staff-list');
    calls.push(body);
    if (unavailable) return reply.json({ error: 'Print service is temporarily unavailable.' }, 503);
    return reply.json({ requests: body.lookup ? [] : [{ requestId, code, createdAt, specification,
      quantity: 1, status: 'awaiting_marketplace_order' }] });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(staffUrl);
  await expect(page.getByRole('alert')).toContainText("We couldn't load the queue");
  await expect(page.locator('.staff-count')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('staff-desktop-error.png'), fullPage: true });
  unavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(code) })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('staff-desktop-queue.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Reference or order ID').fill('NOT-FOUND');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('heading', { name: 'No matching requests' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByLabel('Reference or order ID')).toHaveValue('');
  await expect(page.getByRole('button', { name: new RegExp(code) })).toBeVisible();
  expect(calls.at(-1).lookup).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath('staff-mobile-queue.png'), fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
