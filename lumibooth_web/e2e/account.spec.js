import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import process from 'node:process';

const origin = 'https://lumi-test.invalid';
const email = 'guest@example.com';
const user = { id: 'account-user', email, aud: 'authenticated', role: 'authenticated', is_anonymous: false };
const expires = Math.floor(Date.now() / 1000) + 3600;
const claims = Buffer.from(JSON.stringify({ exp: expires, sub: user.id })).toString('base64url');
const session = {
  access_token: `eyJhbGciOiJIUzI1NiJ9.${claims}.fake`,
  refresh_token: 'refresh-account',
  expires_in: 3600,
  user,
};

test.skip(process.env.VITE_LUMI_SUPABASE_URL !== origin, 'Run against the online test build.');

test('optional accounts support confirmation, login, recovery and keeping a guest draft', async ({ page }) => {
  let recoveryUrl;
  let confirmUrl;
  let updatedPassword;
  const accountRequests = [];
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    };
    const respond = (json, status = 200) => route.fulfill({ status, json, headers });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    accountRequests.push(url.pathname);
    if (url.pathname === '/auth/v1/signup') {
      confirmUrl = new URL(url.searchParams.get('redirect_to'));
      return respond({ ...user, identities: [] });
    }
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON();
      if (body.password === 'wrong-password') {
        return respond({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 400);
      }
      return respond(session);
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/v1/recover') {
      recoveryUrl = new URL(url.searchParams.get('redirect_to'));
      return respond({});
    }
    if (url.pathname === '/auth/v1/user' && method === 'PUT') {
      updatedPassword = request.postDataJSON().password;
      return respond(user);
    }
    return respond({ error: 'Unexpected request' }, 404);
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sb-lumi-test-auth-token', 'existing-online-guest'));
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await page.getByRole('button', { name: /Single Photo/ }).click();
  const photo = await page.evaluate(() => document.createElement('canvas').toDataURL().split(',')[1]);
  await page.getByLabel('Choose image files').setInputFiles({
    name: 'guest-photo.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeEnabled();
  await page.getByRole('link', { name: 'LumiBooth home' }).click();
  await expect(page.getByRole('link', { name: 'Continue your strip' })).toBeVisible();
  expect(accountRequests).toEqual([]);

  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('original-password');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for a confirmation link.');
  expect(confirmUrl.pathname).toBe('/account');
  confirmUrl.searchParams.set('code', 'confirm-code');
  await page.goto(confirmUrl.href);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid login credentials');
  await page.getByLabel('Password', { exact: true }).fill('original-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.reload();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('a reset link is on its way');
  recoveryUrl.searchParams.set('code', 'recover-code');
  await page.goto(recoveryUrl.href);
  await page.getByLabel('New password').fill('updated-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toHaveText('Your password has been updated.');
  expect(updatedPassword).toBe('updated-password');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('link', { name: 'Back to photo booth' }).click();
  await page.getByRole('link', { name: 'Continue your strip' }).click();
  await expect(page.getByRole('button', { name: /Single Photo/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Continue to design' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('sb-lumi-test-auth-token'))).toBe('existing-online-guest');
  expect(accountRequests.every((path) => path.startsWith('/auth/'))).toBe(true);
});

test('an unreachable account service leaves the guest booth available', async ({ page }) => {
  await page.route(`${origin}/**`, (route) => route.abort());
  await page.goto('/account');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('original-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not reach the account service');
  await page.getByRole('link', { name: 'Back to photo booth' }).click();
  await page.getByRole('button', { name: 'Create photo strip' }).click();
  await expect(page).toHaveURL(/\/gallery$/);
});
