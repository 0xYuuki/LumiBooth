import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const backend = 'http://127.0.0.1:54321';
const edge = 'http://127.0.0.1:8000';
const staffUrl = 'http://127.0.0.1:4187/';
const localStack = process.env.LUMI_TEST_STAFF === 'true' && process.env.VITE_LUMI_COMMERCE === 'true' && process.env.VITE_LUMI_SUPABASE_URL === backend;
const listing = 'https://www.tiktok.com/test-print-fulfillment';
const width = 240;
const height = 360;

async function pngFingerprint(page, data) {
  return page.evaluate(async dataUrl => {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = context.getImageData(0, 0, width, height);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return { width, height, pixels: Array.from(new Uint8Array(hash)) };
  }, data);
}

test('camera capture through verified print and tracking on the local commerce stack', async ({ page: buyer, browser, request }) => {
  test.skip(!localStack, 'Requires the isolated local Supabase and print service.');
  test.setTimeout(90000);
  await buyer.setViewportSize({ width: 390, height: 844 });

  const serviceKey = process.env.LUMI_TEST_SERVICE_ROLE_KEY;
  const container = process.env.LUMI_TEST_DB_CONTAINER ?? 'supabase_db_lumibooth';
  expect(Boolean(serviceKey)).toBe(true);
  expect(container).toMatch(/^supabase_db_lumibooth(?:-[a-z0-9-]+)?$/);
  const email = `staff-${randomUUID()}@example.com`;
  const password = randomUUID();
  const account = await request.post(`${backend}/auth/v1/admin/users`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    data: { email, password, email_confirm: true },
  });
  expect(account.status()).toBe(200);
  const { id } = await account.json();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const productId = randomUUID();
  const sku = `e2e-${productId}`;
  const orderId = `TEST-${randomUUID()}`;
  execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: `
      insert into lumi_commerce.staff_roles (user_id) values ('${id}');
      insert into lumi_commerce.print_products
        (id, kind, sku, title, variant, reference_prefix, tiktok_url, width_px, height_px,
         bleed_px, safe_inset_px, target_dpi, minimum_dpi, low_resolution_policy, max_png_bytes,
         max_quantity, pending_ttl_minutes, consent_version, consent_text, buyer_instructions, enabled)
      values ('${productId}', 'strip', '${sku}', 'E2E portrait', 'Gloss', 'QA', '${listing}', ${width}, ${height},
        12, 8, 300, 180, 'warn', 1000000, 2, 20, 'test-v1', 'Upload one print file for fulfillment.',
        'Send the print reference in your order chat.', true);
    `,
  });

  let uploaded = 0;
  // Forward only the function path to the local Deno process. Auth and Storage use Supabase.
  const forward = async route => {
    const incoming = new URL(route.request().url());
    const path = incoming.pathname.replace('/functions/v1/print-commerce', '');
    const response = await route.fetch({ url: `${edge}${path}${incoming.search}` });
    if (path.endsWith('/upload') && route.request().method() === 'POST') {
      expect(response.status()).toBe(200);
      if (++uploaded === 1) return route.abort();
    }
    return route.fulfill({ response });
  };
  const functionRoute = `${backend}/functions/v1/print-commerce/**`;
  await buyer.route(functionRoute, forward);

  await buyer.goto('/');
  await buyer.getByRole('button', { name: 'Create photo strip' }).click();
  await buyer.getByRole('button', { name: /Single Photo/ }).click();
  await buyer.getByRole('link', { name: 'Take photos', exact: true }).click();
  await buyer.getByRole('button', { name: 'Timer off' }).click();
  await buyer.getByRole('button', { name: 'Take photo' }).click();
  await buyer.getByRole('button', { name: 'Continue to design' }).click();
  await buyer.getByLabel('Frame category', { exact: true }).selectOption('Colors');
  await buyer.getByRole('button', { name: 'Black', exact: true }).click();
  await buyer.getByRole('button', { name: 'Next', exact: true }).click();
  await buyer.getByRole('link', { name: 'Order Print' }).click();
  await buyer.getByLabel('Product and variant').selectOption(productId);
  const preview = buyer.getByRole('img', { name: 'Cropped print preview' });
  const original = await preview.evaluate(canvas => canvas.toDataURL());
  await buyer.getByLabel('Zoom').fill('1.25');
  const edited = await preview.evaluate(canvas => canvas.toDataURL());
  const fingerprint = await pngFingerprint(buyer, edited);
  expect(fingerprint).toMatchObject({ width, height });
  expect(fingerprint.pixels).not.toEqual((await pngFingerprint(buyer, original)).pixels);
  await expect(buyer.getByText(/12px bleed/)).toBeVisible();
  await expect(buyer.getByText(/inside the dotted safe area/)).toBeVisible();

  await buyer.getByRole('checkbox', { name: /Upload this print PNG/ }).check();
  await buyer.getByRole('button', { name: 'Confirm and upload' }).click();
  await expect(buyer.getByRole('alert')).toContainText('Upload interrupted');
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Retry upload' }).click();
  await expect(buyer.getByLabel('Print reference')).toHaveValue(/^QA-[0-9A-F]{12}$/);
  expect(uploaded).toBe(1);
  const code = await buyer.getByLabel('Print reference').inputValue();
  await buyer.route(listing, route => route.fulfill({ contentType: 'text/html', body: '<title>Fixture listing</title>' }));
  await buyer.getByRole('button', { name: 'Open TikTok Shop' }).click();
  await expect(buyer).toHaveURL(listing);
  await buyer.goBack();
  await expect(buyer.getByLabel('Print reference')).toHaveValue(code);

  const staff = await browser.newPage();
  try {
    await staff.route(functionRoute, forward);
    await staff.goto(staffUrl);
    await staff.getByRole('link', { name: 'Sign in with your staff account' }).click();
    await staff.getByLabel('Email').fill(email);
    await staff.getByLabel('Password', { exact: true }).fill(password);
    await staff.getByRole('button', { name: 'Log in' }).click();
    await expect(staff.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await staff.goto(staffUrl);
    await staff.getByLabel('Reference or order ID').fill(code);
    await staff.getByRole('button', { name: 'Apply filters' }).click();
    await staff.getByRole('button', { name: new RegExp(code) }).click();
    await expect(staff.getByText(/The private print file is locked/)).toBeVisible();
    await expect(staff.getByRole('button', { name: 'Download print PNG' })).toHaveCount(0);

    await staff.getByLabel('TikTok order ID').fill(orderId);
    await staff.getByLabel('Purchased SKU').fill(sku);
    await staff.getByLabel('Purchased variant').fill('Gloss');
    await staff.getByLabel('Quantity on order line').fill('1');
    await staff.getByLabel(/I verified the purchase/).check();
    await staff.getByRole('button', { name: 'Verify and match purchase' }).click();
    await staff.getByRole('button', { name: 'Load preview' }).click();
    await expect(staff.getByRole('img', { name: 'Verified print file' })).toBeVisible();
    const downloadEvent = staff.waitForEvent('download');
    await staff.getByRole('button', { name: 'Download print PNG' }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(`lumibooth-${code}.png`);
    const png = await readFile(await download.path());
    expect(await pngFingerprint(staff, `data:image/png;base64,${png.toString('base64')}`)).toEqual(fingerprint);

    for (const name of ['Release to print queue', 'Start printing', 'Mark packed']) {
      await staff.getByRole('button', { name, exact: true }).click();
    }
    await staff.getByLabel('Waybill or tracking reference (optional)').fill('TEST-TRACK-1');
    await staff.getByRole('button', { name: 'Record shipment' }).click();
    await expect(staff.getByText('TEST-TRACK-1').first()).toBeVisible();
    await staff.getByRole('button', { name: 'Mark completed' }).click();
    await expect(staff.locator('.staff-print-status')).toHaveText("Completed");
    await buyer.getByRole('button', { name: 'Refresh status' }).click();
    await expect(buyer.getByText('Quantity 1 · Completed')).toBeVisible();
    await expect(buyer.getByText('TEST-TRACK-1')).toHaveCount(0);
  } finally {
    await staff.close();
  }
});
