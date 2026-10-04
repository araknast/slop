import { expect, test } from '@playwright/test';
import { card, post, signUp, uniq } from './helpers';

test.describe('posting', () => {
  test('create a post, it shows in the feed and survives reload', async ({ page }) => {
    await signUp(page);
    const text = `hello ${uniq()}`;
    await post(page, text);
    await expect(page.getByPlaceholder("What's happening?")).toHaveValue('');
    await page.reload();
    await expect(card(page, text)).toBeVisible();
  });

  test('character counter blocks posts over 280 characters', async ({ page }) => {
    await signUp(page);
    await page.getByPlaceholder("What's happening?").fill('x'.repeat(281));
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
    await expect(page.locator('.over-text')).toHaveText('-1');
    await page.getByPlaceholder("What's happening?").fill('x'.repeat(280));
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  });

  test('like toggles, updates the count, and persists', async ({ page }) => {
    await signUp(page);
    const text = `like me ${uniq()}`;
    await post(page, text);
    const like = card(page, text).locator('.act.pink');
    await like.click();
    await expect(like).toHaveClass(/on/);
    await expect(like).toContainText('1');
    await page.reload();
    await expect(card(page, text).locator('.act.pink')).toHaveClass(/on/);
    await card(page, text).locator('.act.pink').click();
    await expect(card(page, text).locator('.act.pink')).not.toHaveClass(/on/);
    await expect(card(page, text).locator('.act.pink')).not.toContainText('1');
  });

  test('reply appears in the thread and bumps the reply count', async ({ page }) => {
    await signUp(page);
    const text = `thread ${uniq()}`;
    await post(page, text);
    await card(page, text).locator('.text').click();
    await expect(page).toHaveURL(/\/post\/\d+/);
    const reply = `reply ${uniq()}`;
    await page.getByPlaceholder('Post your reply').fill(reply);
    await page.getByRole('button', { name: 'Reply' }).click();
    await expect(card(page, reply)).toBeVisible();
    await page.goBack();
    await expect(card(page, text).locator('.act').first()).toContainText('1');
  });

  test('replies do not appear in the global feed', async ({ page }) => {
    await signUp(page);
    const text = `parent ${uniq()}`;
    await post(page, text);
    await card(page, text).locator('.text').click();
    const reply = `child ${uniq()}`;
    await page.getByPlaceholder('Post your reply').fill(reply);
    await page.getByRole('button', { name: 'Reply' }).click();
    await expect(card(page, reply)).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(card(page, text)).toBeVisible();
    await expect(page.locator('.post', { hasText: reply })).toHaveCount(0);
  });

  test('another user can like and repost; repost shows in feed', async ({ page, browser }) => {
    const { username: author } = await signUp(page, uniq('a'), 'Author');
    const text = `share ${uniq()}`;
    await post(page, text);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signUp(p2, uniq('b'), 'Fan');
    await p2.goto(`/u/${author}`);
    const c = card(p2, text);
    await c.locator('.act.green').click();
    await expect(c.locator('.act.green')).toHaveClass(/on/);
    await p2.getByRole('link', { name: 'Home' }).click();
    await expect(p2.locator('.repost-line', { hasText: 'Fan reposted' })).toBeVisible();
    // undo repost
    await p2.locator('.post', { hasText: text }).first().locator('.act.green').click();
    await expect(p2.locator('.post', { hasText: text }).first().locator('.act.green')).not.toHaveClass(/on/);
    await p2.reload();
    await expect(p2.locator('.repost-line')).toHaveCount(0);
    await ctx.close();
  });

  test('delete own post removes it; others cannot delete', async ({ page, browser }) => {
    const { username: author } = await signUp(page, uniq('a'));
    const text = `delete ${uniq()}`;
    await post(page, text);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await signUp(p2, uniq('b'));
    await p2.goto(`/u/${author}`);
    await expect(card(p2, text)).toBeVisible();
    await expect(card(p2, text).locator('.del')).toHaveCount(0);
    await ctx.close();

    await card(page, text).hover();
    await card(page, text).locator('.del').click();
    await expect(page.locator('.post', { hasText: text })).toHaveCount(0);
  });

  test('infinite scroll loads older posts', async ({ page, request }) => {
    const { username } = await signUp(page);
    // seed 25 posts through the API using the page's session
    const cookies = await page.context().cookies();
    const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    for (let i = 0; i < 25; i++) {
      const r = await request.post('http://localhost:3001/api/posts', { headers: { cookie: header }, data: { body: `bulk ${username} ${i}` } });
      expect(r.ok()).toBeTruthy();
    }
    await page.reload();
    await expect(page.locator('.post').first()).toBeVisible();
    // the feed is windowed: older posts are only mounted once scrolled near, so keep scrolling until the oldest shows
    await expect(async () => {
      await page.mouse.wheel(0, 20000);
      await expect(page.locator('.post', { hasText: `bulk ${username} 0` })).toBeVisible({ timeout: 700 });
    }).toPass({ timeout: 15_000 });
  });
});
