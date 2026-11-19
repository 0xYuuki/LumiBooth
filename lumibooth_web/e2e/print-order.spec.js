import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const backend = 'https://lumi-test.invalid';
const enabled = process.env.VITE_LUMI_COMMERCE === 'true' && process.env.VITE_LUMI_SUPABASE_URL === backend;
const product = {
  id: 'd10f2a29-d537-456d-b209-59269067bf9a', sku: 'test-strip', title: 'Test strip', variant: 'Gloss',
  tiktok_url: 'https://www.tiktok.com/test-print-listing', buyer_instructions: 'Send the code using the test seller instructions.',
  width_px: 240, height_px: 360, bleed_px: 12, safe_inset_px: 8, target_dpi: 300, minimum_dpi: 180,
  low_resolution_policy: 'warn', max_png_bytes: 1_000_000, max_quantity: 3,
  consent_version: 'test-v1', consent_text: 'This test uploads one print PNG for staff fulfillment.',
};
const blocked = {
  ...product, id: 'f5355edb-7850-4cad-bd9e-a6c89029817c', sku: 'test-matte', variant: 'Matte',
  width_px: 1200, height_px: 1800, minimum_dpi: 300, low_resolution_policy: 'block',
};

async function finishStrip(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await page.getByRole('button', { name: /Single Photo/ }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    context.fillStyle = '#af3333';
    context.fillRect(0, 0, 30, 80);
    context.fillStyle = '#223aa0';
    context.fillRect(30, 0, 30, 80);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('Choose image files').setInputFiles({
    name: 'guest.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  await page.getByRole('button', { name: 'Continue to design' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Your finished LumiBooth photo strip' })).toBeVisible();
}

test('Print orders and Order Print are hidden when commerce is off', async ({ page }) => {
  test.skip(process.env.VITE_LUMI_COMMERCE === 'true', 'Requires the ordinary booth build.');
  await finishStrip(page);
  await expect(page.getByRole('link', { name: 'Order Print' })).toHaveCount(0);
  await page.goto('/print-orders');
  await expect(page.getByRole('link', { name: 'Continue your strip' })).toBeVisible();
});

test('guest reviews the print, explicitly uploads, resumes an interrupted receipt and opens a valid listing', async ({ page }) => {
  test.skip(!enabled, 'Requires the commerce browser test build.');
  await page.setViewportSize({ width: 390, height: 844 });
  let available = true;
  let status = 'draft_upload';
  let createCount = 0;
  let receiptToken;
  let uploadCount = 0;
  let bytes;
  const requestId = 'f0716ecf-b395-4ce5-9970-f90bff01ca35';
  const userId = '459e9da1-de85-40b4-ac8d-e58341dfbaa6';
  const summary = () => ({ requestId, code: status !== 'draft_upload' ? 'PS-0123456789AB' : null,
    quantity: 2, status, specification: product, expiresAt: '2030-12-01T10:00:00Z' });
  await page.route(`${backend}/**`, async route => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const accept = (json, status = 200) => route.fulfill({ status, json, headers });
    if (pathname === '/auth/v1/signup') {
      const claim = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      return accept({ access_token: `eyJhbGciOiJIUzI1NiJ9.${claim}.fake`, refresh_token: 'guest',
        expires_in: 3600, user: { id: userId, is_anonymous: true } });
    }
    if (pathname.endsWith('/catalog')) return accept({ products: available ? [product, blocked] : [blocked] });
    if (pathname.endsWith('/create')) {
      const json = req.postDataJSON();
      createCount++;
      expect(json).toMatchObject({ productId: product.id, quantity: 2, consentAccepted: true, consentVersion: 'test-v1' });
      expect(json.receiptToken).toMatch(/^[0-9a-f]{64}$/);
      receiptToken = json.receiptToken;
      expect(req.headers().authorization).toMatch(/^Bearer /);
      return accept(summary());
    }
    expect(req.headers()['x-lumi-receipt']).toBe(receiptToken);
    if (pathname.endsWith('/status')) return accept(summary());
    if (pathname.endsWith('/upload')) {
      uploadCount++;
      const body = req.postDataBuffer();
      if (uploadCount === 1) {
        bytes = body;
        return route.abort('failed');
      }
      expect(body.equals(bytes)).toBe(true);
      status = 'awaiting_marketplace_order';
      return accept(summary());
    }
    return accept({ error: 'Unexpected route' }, 404);
  });

  await finishStrip(page);
  await page.getByRole('link', { name: 'Order Print' }).click();
  await expect(page.getByRole('img', { name: 'Cropped print preview' })).toBeVisible();
  await expect(page.getByText(/12px bleed/)).toBeVisible();
  await expect(page.getByText(/inside the dotted safe area/)).toBeVisible();
  const consent = page.getByRole('checkbox', { name: /Upload this print PNG/ });
  const confirm = page.getByRole('button', { name: 'Confirm and upload' });
  await page.getByLabel('Product and variant').selectOption(blocked.id);
  await consent.check();
  await expect(confirm).toBeDisabled();
  await expect(page.getByText(/Use a crop or photo that meets the 300 DPI minimum/)).toBeVisible();
  await page.getByLabel('Product and variant').selectOption(product.id);
  await expect(consent).not.toBeChecked();
  await expect(confirm).toBeDisabled();
  expect(createCount).toBe(0);
  expect(uploadCount).toBe(0);

  await page.getByLabel('Quantity').fill('2');
  await page.getByLabel('Horizontal position').fill('80');
  await page.getByLabel('Zoom').fill('1.25');
  const canvas = page.getByRole('img', { name: 'Cropped print preview' });
  const rendered = await canvas.evaluate(element => element.toDataURL().split(',')[1]);
  expect(await canvas.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(390);
  await consent.check();
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Print receipt' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Upload interrupted');
  expect(bytes.toString('base64')).toBe(rendered);
  expect(page.url()).not.toContain(receiptToken);
  await page.reload();
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await expect(page.getByLabel('Print reference')).toHaveValue('PS-0123456789AB');
  await expect(page.getByText(/store has yet to confirm/)).toBeVisible();
  expect(createCount).toBe(1);
  expect(uploadCount).toBe(2);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText() { return Promise.reject(); } } });
  });
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByText('Select and copy the reference shown above.')).toBeVisible();

  available = false;
  await page.getByRole('button', { name: 'Open TikTok Shop' }).click();
  await expect(page.getByRole('alert')).toContainText('listing or checkout details changed');
  await expect(page).toHaveURL(/\/print-orders\//);

  available = true;
  await page.route(product.tiktok_url, route => route.fulfill({ body: '<title>Test listing</title>' }));
  await page.getByRole('button', { name: 'Open TikTok Shop' }).click();
  await expect(page).toHaveURL(product.tiktok_url);
  await page.goBack();
  await expect(page.getByLabel('Print reference')).toHaveValue('PS-0123456789AB');
  status = 'expired';
  await page.getByRole('button', { name: 'Refresh status' }).click();
  await expect(page.getByText(/This request expired/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open TikTok Shop' })).toHaveCount(0);
});
