import { expect, test } from '@playwright/test';
import { post, signUp, uniq } from './helpers';

test.describe('profiles', () => {
  test('profile shows user info and only their posts', async ({ page, browser }) => {
    const { username } = await signUp(page, uniq('p'), 'Profile Person');
    const mine = `mine ${uniq()}`;
    await post(page, mine);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signUp(p2, uniq('q'), 'Other');
    const theirs = `theirs ${uniq()}`;
    await post(p2, theirs);
    await ctx.close();

    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${username}$`));
    await expect(page.getByRole('heading', { name: 'Profile Person' }).first()).toBeVisible();
    await expect(page.getByText(`@${username}`).first()).toBeVisible();
    await expect(page.locator('.post', { hasText: mine })).toBeVisible();
    await expect(page.locator('.post', { hasText: theirs })).toHaveCount(0);
  });

  test('edit profile updates name and bio everywhere', async ({ page }) => {
    await signUp(page, uniq('e'), 'Before');
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.locator('.edit-form input').fill('After Name');
    await page.locator('.edit-form textarea').fill('hello bio');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'After Name' }).first()).toBeVisible();
    await expect(page.getByText('hello bio')).toBeVisible();
    await expect(page.locator('.rail-user')).toContainText('After Name');
  });

  test('visiting someone else shows no edit button; unknown user shows an error', async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    const { username } = await signUp(p2, uniq('o'));
    await ctx.close();
    await signUp(page);
    await page.goto(`/u/${username}`);
    await expect(page.getByText(`@${username}`).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(0);
    await page.goto('/u/nobody_here_zzz');
    await expect(page.getByText('User not found')).toBeVisible();
  });
});
