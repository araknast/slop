import { expect, type Page } from '@playwright/test';

export const uniq = (p = 'u') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 28);

export async function signUp(page: Page, username = uniq(), displayName = 'Test User') {
  await page.goto('/');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Display name').fill(displayName);
  await page.getByPlaceholder(/Password/).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByPlaceholder("What's happening?")).toBeVisible();
  return { username, displayName };
}

export async function post(page: Page, text: string) {
  await page.getByPlaceholder("What's happening?").fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByPlaceholder("What's happening?")).toHaveValue(''); // mutation settled
  await expect(page.locator('.post', { hasText: text }).first()).toBeVisible();
}

export const card = (page: Page, text: string) => page.locator('.post', { hasText: text }).first();
