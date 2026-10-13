import { expect, test } from '@playwright/test';

const guide = '/en/places/willow-museum/guide';

test('the old example address redirects to the one guide address, in every language', async ({ page }) => {
  for (const locale of ['en', 'ro', 'de']) {
    await page.goto(`/${locale}/example-guide`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/places/willow-museum/guide$`));
  }
});

test('only the example place exists, and the header button and the QR address open it', async ({ page }) => {
  expect((await page.goto('/en/places/unknown-place/guide'))?.status()).toBe(404);
  await page.goto('/en');
  await page.getByRole('link', { name: 'Example guide', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${guide}$`));
  await page.goto('/q/willow-museum?locale=ro');
  await expect(page).toHaveURL(/\/ro\/places\/willow-museum\/guide$/);
});

test('one label stands above the guide: the others are gone', async ({ page }) => {
  await page.goto(guide);
  await expect(page.getByText('Museum pre-visit guide', { exact: true })).toHaveCount(1);
  await expect(page.getByText('What a visitor sees')).toHaveCount(0);
  await expect(page.locator('main .badge')).toHaveCount(0);
});

test('on a phone the guide has no frame or scroll box, and the step buttons stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(guide);
  const device = page.locator('.guide-device');
  await expect(device).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.gg-scroll')).toHaveCSS('overflow-y', 'visible');
  const sound = page.locator('.gg-chrow', { hasText: 'Sound' });
  await sound.scrollIntoViewIfNeeded();
  const soundBox = (await sound.boundingBox())!;
  const nav = (await page.locator('.gg-footer').boundingBox())!;
  expect(nav.y + nav.height).toBeLessThanOrEqual(800);
  // The row is fully visible and not covered by the sticky step buttons.
  expect(soundBox.y + soundBox.height).toBeLessThanOrEqual(nav.y + 1);
  await expect(page.locator('.gg-footer button').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guide options', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('on a large screen the guide stays in its phone-sized frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(guide);
  await expect(page.locator('.guide-device')).toHaveCSS('border-top-width', '8px');
});

test('Variable has its own symbol, and the home preview uses the same squares as the guide', async ({ page }) => {
  await page.goto(guide);
  const row = page.locator('.gg-chrow', { hasText: 'Variable' }).first();
  await expect(row).toBeVisible();
  const classes = await row.locator('.gg-sq > span').evaluateAll((spans) => spans.map((span) => span.className));
  expect(classes).toEqual(['on', '', 'on']);
  await page.goto('/en');
  const home = page.locator('.sensory-mini .gg-sq');
  await expect(home).toHaveCount(2);
  expect(await home.first().locator('span').evaluateAll((spans) => spans.map((span) => span.className))).toEqual(['on', '', 'on']);
  await expect(page.locator('.sensory-mini .gg-chip')).toHaveCount(0);
});

test('a scan of the example code opens it in the phone language, and an asked-for language wins', async ({ browser }) => {
  const phone = await browser.newContext({ locale: 'de-DE' });
  const page = await phone.newPage();
  await page.goto('/q/willow-museum');
  await expect(page).toHaveURL(/\/de\/places\/willow-museum\/guide$/);
  await page.goto('/q/willow-museum?locale=ro');
  await expect(page).toHaveURL(/\/ro\/places\/willow-museum\/guide$/);
  await phone.close();
});

test('a code nobody made is a plain 404, and the notice page names no location', async ({ page, request }) => {
  expect((await request.get('/q/ffffffff', { maxRedirects: 0 })).status()).toBe(404);
  await page.goto('/en/guide-unavailable');
  await expect(page.getByRole('heading', { name: "This guide isn't available right now" })).toBeVisible();
  await page.goto('/ro/guide-unavailable');
  await expect(page.getByRole('heading', { name: 'Acest ghid nu este disponibil acum' })).toBeVisible();
});
