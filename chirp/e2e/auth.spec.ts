import { expect, test } from '@playwright/test';
import { signUp, uniq } from './helpers';

test.describe('auth', () => {
  test('landing page shows hero and sign-up form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Say it');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('sign up, persists across reload, log out, log in', async ({ page }) => {
    const { username, displayName } = await signUp(page);
    await expect(page.locator('.rail-user')).toContainText(displayName);
    await page.reload();
    await expect(page.getByPlaceholder("What's happening?")).toBeVisible(); // session cookie survived

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByPlaceholder('Username').fill(username);
    await page.getByPlaceholder(/Password/).fill('password123');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByPlaceholder("What's happening?")).toBeVisible();
  });

  test('wrong password shows an error', async ({ page }) => {
    const { username } = await signUp(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Log in' }).first().click();
    await page.getByPlaceholder('Username').fill(username);
    await page.getByPlaceholder(/Password/).fill('nottherightone');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('duplicate username is rejected', async ({ page, browser }) => {
    const { username } = await signUp(page);
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto('/');
    await p2.getByPlaceholder('Username').fill(username);
    await p2.getByPlaceholder('Display name').fill('Dup');
    await p2.getByPlaceholder(/Password/).fill('password123');
    await p2.getByRole('button', { name: 'Create account' }).click();
    await expect(p2.getByText('Username already taken')).toBeVisible();
    await ctx.close();
  });

  test('invalid usernames are rejected', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Username').fill('a b!');
    await page.getByPlaceholder('Display name').fill('X');
    await page.getByPlaceholder(/Password/).fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('.error')).toBeVisible();
  });

  test('unauthenticated deep links redirect to the landing page', async ({ page }) => {
    await page.goto('/post/1');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    void uniq;
  });
});
