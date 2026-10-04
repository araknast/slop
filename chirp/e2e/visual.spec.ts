import { expect, test, type Page } from '@playwright/test';
import { post, signUp, uniq } from './helpers';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-${name}.png`, fullPage: false });

/** Overflow / layout sanity that applies to every page and viewport. */
async function expectSane(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test.describe('visual', () => {
  test.setTimeout(90_000);
  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await page.waitForTimeout(1200); // let entrance animations settle
    await expectSane(page);
    await shot(page, 'landing');
  });

  test('feed, post detail and profile', async ({ page }) => {
    await signUp(page, uniq('v'), 'Vivian Visual');
    await post(page, `Parallax, glass and aurora — this is the first chirp! ✨ ${uniq()}`);
    await post(page, `A much longer post to check wrapping behaviour ${uniq()}: ` + 'lorem ipsum dolor sit amet '.repeat(6));
    await post(page, `Third #hashtag ${uniq()} https://example.com/a/very/long/url/that/should/not/overflow/the/card/at/all/ever`);
    await page.locator('.act.pink').first().click();
    await page.waitForTimeout(1200);
    await expectSane(page);
    await shot(page, 'feed');

    await page.locator('.post .text').first().click();
    await expect(page).toHaveURL(/\/post\//);
    await page.waitForTimeout(900);
    await expectSane(page);
    await shot(page, 'post-detail');

    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page.locator('.profile')).toBeVisible();
    await page.waitForTimeout(900);
    await expectSane(page);
    await shot(page, 'profile');
  });

  test('glass, GPU hints and parallax are really applied', async ({ page }) => {
    await signUp(page);
    await post(page, `style check ${uniq()}`);
    const info = await page.evaluate(() => {
      const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      return {
        blur: cs('.post').backdropFilter || cs('.post').getPropertyValue('-webkit-backdrop-filter'),
        willChange: cs('.aurora .layer').willChange,
        position: cs('.aurora').position,
        tiltWill: cs('.tilt').willChange,
        layers: document.querySelectorAll('.aurora .layer').length,
      };
    });
    expect(info.blur).toContain('blur');
    expect(info.willChange).toBe('transform');
    expect(info.position).toBe('fixed');
    expect(info.tiltWill).toBe('transform');
    expect(info.layers).toBeGreaterThanOrEqual(2);
  });

  test('aurora layers move at different speeds on scroll (parallax)', async ({ page, request }) => {
    const { username } = await signUp(page);
    const header = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    for (let i = 0; i < 15; i++) await request.post('http://localhost:3001/api/posts', { headers: { cookie: header }, data: { body: `scroll filler ${username} ${i}` } });
    await page.reload();
    await expect(page.locator('.post').first()).toBeVisible();
    const ty = () => page.evaluate(() => [...document.querySelectorAll('.aurora .layer')].map((el) => new DOMMatrix(getComputedStyle(el).transform).m42));
    await page.mouse.move(640, 400);
    const before = await ty();
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
    await page.waitForTimeout(600);
    const after = await ty();
    const d = after.map((v, i) => Math.abs(v - before[i]));
    expect(d[0]).toBeGreaterThan(1);
    expect(d[1]).toBeGreaterThan(d[0]); // nearer layer travels further
  });

  test('prefers-reduced-motion disables parallax', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await signUp(page);
    await page.mouse.move(100, 100);
    await page.mouse.move(1100, 700);
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => [...document.querySelectorAll('.aurora .layer')].map((el) => getComputedStyle(el).transform));
    for (const m of t) expect(m === 'none' || new DOMMatrix(m).m41 === 0).toBeTruthy();
    await ctx.close();
  });
});
