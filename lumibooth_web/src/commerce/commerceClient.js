import { guestSession } from '../online/lumiClient';
import { loadPrintFile, storePrintReceipt } from './printReceipts';

const url = import.meta.env.VITE_LUMI_SUPABASE_URL;
const key = import.meta.env.VITE_LUMI_SUPABASE_KEY;
const endpoint = route => `${url.replace(/\/$/, '')}/functions/v1/print-commerce/v1/${route}`;

function requireOnline() {
  if (navigator.onLine === false) throw new Error('You’re offline. Reconnect and try again.');
}

async function request(route, json = {}, { token, receipt } = {}) {
  requireOnline();
  const response = await fetch(endpoint(route), {
    method: 'POST',
    headers: {
      apikey: key, 'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(receipt && { 'X-Lumi-Receipt': receipt }),
    },
    body: JSON.stringify(json), cache: 'no-store', signal: AbortSignal.timeout(15_000),
  }).catch(() => { throw new Error('Could not reach the print service. Try again.'); });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'Print ordering is unavailable. Try again.');
  return result;
}

const printStatuses = new Set([
  'draft_upload', 'awaiting_marketplace_order', 'needs_review', 'verified', 'print_ready',
  'printing', 'packed', 'shipped', 'completed', 'cancelled', 'refunded', 'expired',
]);

function checkedReceipt(input, requestId) {
  if (!input || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(input.requestId) ||
      (requestId && input.requestId !== requestId) || !printStatuses.has(input.status) ||
      !input.specification || !Number.isInteger(input.quantity) ||
      (!['draft_upload', 'expired'].includes(input.status) && !/^[A-Z]{2,5}-[A-F0-9]{12}$/.test(input.code))) {
    throw new Error('Could not confirm the print receipt. Retry from Print orders.');
  }
  const { requestId: id, code, status, quantity, specification, expiresAt } = input;
  return { requestId: id, code, status, quantity, specification, expiresAt };
}

function upload(intent, png, progress) {
  requireOnline();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint(`upload?requestId=${encodeURIComponent(intent.requestId)}`));
    xhr.setRequestHeader('apikey', key);
    xhr.setRequestHeader('Content-Type', 'image/png');
    xhr.setRequestHeader('X-Lumi-Receipt', intent.receiptToken);
    xhr.timeout = 90_000;
    xhr.responseType = 'json';
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) progress(Math.floor(100 * event.loaded / event.total));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(xhr.response?.error ?? 'Could not confirm the upload. Retry from Print orders.'));
        return;
      }
      try { resolve(checkedReceipt(xhr.response, intent.requestId)); }
      catch (reason) { reject(reason); }
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Upload interrupted. Retry from Print orders.'));
    xhr.send(png);
  });
}

export function tiktokListing(value) {
  try {
    const link = new URL(value);
    if (link.protocol === 'https:' && !link.username && !link.password &&
        (link.hostname === 'tiktok.com' || link.hostname.endsWith('.tiktok.com'))) return link.href;
  } catch { /* Invalid listing configuration. */ }
  return null;
}

export function sameProduct(a, b) {
  return Boolean(a && b && [
    'id', 'sku', 'variant', 'title', 'tiktok_url', 'buyer_instructions', 'width_px', 'height_px', 'bleed_px', 'safe_inset_px',
    'target_dpi', 'minimum_dpi', 'low_resolution_policy', 'max_png_bytes', 'max_quantity', 'consent_version', 'consent_text',
  ].every(field => a[field] === b[field]));
}

export async function printCatalog() {
  const { products } = await request('catalog');
  if (!Array.isArray(products)) throw new Error('The print catalog is unavailable.');
  return products.filter(item => tiktokListing(item.tiktok_url) && item.buyer_instructions?.trim());
}

export async function refreshPrintReceipt(intent) {
  const receipt = checkedReceipt(await request('status', {
    requestId: intent.requestId,
  }, { receipt: intent.receiptToken }), intent.requestId);
  await storePrintReceipt(intent.localId, receipt);
  return { ...intent, ...receipt };
}

export async function submitPrintIntent(intent, progress) {
  let current = intent;
  if (!current.requestId) {
    requireOnline();
    const token = (await guestSession()).access_token;
    const receipt = checkedReceipt(await request('create', {
      productId: current.product.id, quantity: current.quantity, idempotencyKey: current.localId,
      receiptToken: current.receiptToken, consentVersion: current.product.consent_version, consentAccepted: true,
    }, { token }));
    await storePrintReceipt(current.localId, receipt);
    current = { ...current, ...receipt };
  } else {
    current = await refreshPrintReceipt(current);
  }
  if (current.status !== 'draft_upload') return current;
  if (current.quantity !== intent.quantity || !sameProduct(intent.product, current.specification)) {
    throw new Error('The print specification changed. Remove this local draft and start a new request.');
  }
  const png = await loadPrintFile(current.localId);
  if (!png) throw new Error('The local print file is unavailable. Start a new print request from your strip.');
  const receipt = await upload(current, png, progress);
  await storePrintReceipt(current.localId, receipt);
  return { ...current, ...receipt };
}
