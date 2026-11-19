import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPrintCrop, measurePrintDensity, printPlacement, printQuality } from '../src/commerce/printImage.js';

test('the print crop fills the product and moves within the covered image', () => {
  const source = { width: 300, height: 900 };
  const product = { width_px: 300, height_px: 600 };
  assert.deepEqual(printPlacement(source, product, { ...defaultPrintCrop, y: 100 }),
    { scale: 1, width: 300, height: 900, x: 0, y: -300 });
  assert.deepEqual(printPlacement(source, product, { ...defaultPrintCrop, x: 0, zoom: 2 }),
    { scale: 2, width: 600, height: 1800, x: -0, y: -600 });
});

test('DPI reflects native photo detail and zoom and applies the configured policy', () => {
  const photo = { naturalWidth: 150, naturalHeight: 300, clientWidth: 100, clientHeight: 200 };
  const density = measurePrintDensity({ querySelectorAll: () => [photo] }, [{ zoom: 2 }], 3);
  assert.equal(density, 0.25);
  const product = { target_dpi: 300, minimum_dpi: 150 };
  assert.deepEqual(printQuality(density, { scale: 0.6 }, { ...product, low_resolution_policy: 'block' }),
    { dpi: 125, warning: true, blocked: true });
  assert.deepEqual(printQuality(density, { scale: 0.6 }, { ...product, low_resolution_policy: 'warn' }),
    { dpi: 125, warning: true, blocked: false });
});
