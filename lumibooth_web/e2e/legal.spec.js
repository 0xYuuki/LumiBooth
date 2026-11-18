import { expect, test } from '@playwright/test';
import process from 'node:process';

test('guests can read privacy information and see configured legal links', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy information' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy information' })).toBeVisible();
  await expect(page.getByText(/Clearing site data can remove them/)).toBeVisible();

  for (const [title, configured] of [
    ['Privacy Policy', process.env.VITE_LUMI_PRIVACY_URL],
    ['Terms of Use', process.env.VITE_LUMI_TERMS_URL],
  ]) {
    const link = page.getByRole('link', { name: title });
    if (configured?.startsWith('https://')) await expect(link).toHaveAttribute('href', new URL(configured).href);
    else await expect(link).toHaveCount(0);
  }

  await page.getByRole('link', { name: 'Back to photo booth' }).click();
  await expect(page.getByRole('button', { name: 'Create photo strip' })).toBeVisible();
});
