import { expect, test, type Page } from '@playwright/test';

const bar = (page: Page) => page.locator('.topbar');
const openPanel = async (page: Page) => {
  await page.locator('.header-reading').click();
  return page.getByRole('dialog');
};

test('the top bar has language and light or dark; the reading button sits in the sticky header', async ({ page }) => {
  await page.goto('/en/methodology');
  await expect(bar(page).locator('.language-switch summary')).toBeVisible();
  await expect(bar(page).getByRole('button', { name: 'Switch to light mode', exact: true })).toBeVisible();
  await expect(bar(page).getByRole('button')).toHaveCount(1);
  await expect(page.locator('.site-header').getByRole('button', { name: 'Reading settings', exact: true })).toBeVisible();
  // What used to sit here lives in the reading panel now, and the floating edge tab is gone.
  for (const name of ['Cool', 'Warm', 'Summary', 'Full page']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(page.locator('.floating-reading, .reading-trigger')).toHaveCount(0);
});

test('light or dark is an icon with its action as the name and a tooltip', async ({ page }) => {
  await page.goto('/en');
  const toggle = bar(page).locator('.theme-toggle');
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  await expect(toggle).toHaveAttribute('title', 'Switch to light mode');
  expect((await toggle.boundingBox())!.width).toBeLessThan(48);
  await expect(toggle).toHaveText('Switch to light mode');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAccessibleName('Switch to dark mode');
});

test('the reading panel holds the accent colour, and it is remembered', async ({ page }) => {
  await page.goto('/en');
  let panel = await openPanel(page);
  const accent = panel.getByLabel('Accent colour', { exact: true });
  await expect(accent).toHaveValue('cool');
  await expect(accent.locator('option')).toHaveText(['Blue', 'Green']);
  await accent.selectOption('warm');
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'warm');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'warm');
  panel = await openPanel(page);
  await expect(panel.getByLabel('Accent colour', { exact: true })).toHaveValue('warm');
  await panel.getByRole('button', { name: 'Reset', exact: false }).last().click();
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'cool');
});

test('page length is offered only on the text pages, and summary shows its note', async ({ page }) => {
  await page.goto('/en');
  let panel = await openPanel(page);
  await expect(panel.getByLabel('How much of the page to show', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto('/en/methodology');
  panel = await openPanel(page);
  const length = panel.getByLabel('How much of the page to show', { exact: true });
  await expect(length).toHaveValue('full');
  await length.selectOption('summary');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'summary');
  await expect(page.locator('.density-note')).toBeVisible();
  await length.selectOption('full');
  await expect(page.locator('.density-note')).toHaveCount(0);
});

test('the panel fields are translated', async ({ page }) => {
  for (const [locale, accent, length] of [['ro', 'Culoare de accent', 'Cât din pagină să afișăm'], ['de', 'Akzentfarbe', 'Wie viel der Seite anzeigen']]) {
    await page.goto(`/${locale}/methodology`);
    const panel = await openPanel(page);
    await expect(panel.getByLabel(accent, { exact: true })).toBeVisible();
    await expect(panel.getByLabel(length, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('the reading button stays on screen while the page scrolls, and still opens the panel under it', async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 800 }]) {
    await page.setViewportSize(size);
    await page.goto('/en/methodology');
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
    const button = page.locator('.header-reading');
    await expect(button).toBeInViewport();
    const box = (await button.boundingBox())!;
    expect(box.y, `${size.width}px: pinned at the top`).toBeLessThan(80);
    const panel = await openPanel(page);
    const p = (await panel.boundingBox())!;
    expect(p.y).toBeGreaterThanOrEqual(box.y + box.height);
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  }
});

test('on a phone the top bar and the header each fit on one row, down to 320px', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/en');
    const top = await bar(page).locator('.language-switch summary, .theme-toggle').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), right: r.right }; }));
    expect(top).toHaveLength(2);
    expect(new Set(top.map((b) => b.y)).size, `${width}px: top bar on one row`).toBe(1);
    expect(new Set(top.map((b) => b.h)).size, `${width}px: same height`).toBe(1);
    const box = async (selector: string) => page.locator(selector).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { mid: Math.round(r.y + r.height / 2), left: r.left, right: r.right }; });
    const brand = await box('.header-inner .brand-link');
    const reading = await box('.header-inner .header-reading');
    const menu = await box('.header-inner .menu-toggle');
    const rows = [brand.mid, reading.mid, menu.mid];
    expect(Math.max(...rows) - Math.min(...rows), `${width}px: header on one row`).toBeLessThanOrEqual(4);
    expect(menu.right).toBeLessThanOrEqual(width);
    // Brand on the left, then the reading button, then the menu button, none overlapping.
    expect(brand.right).toBeLessThanOrEqual(reading.left + 1);
    expect(reading.right).toBeLessThanOrEqual(menu.left + 1);
    const panel = await openPanel(page);
    const r = (await panel.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('on a narrow phone the reading button is an icon and keeps its name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en');
  const button = page.locator('.header-reading');
  await expect(button).toHaveAccessibleName('Reading settings');
  expect((await button.boundingBox())!.width).toBeLessThan(48);
  await page.setViewportSize({ width: 600, height: 800 });
  expect((await button.boundingBox())!.width).toBeGreaterThan(100);
});

test('on a short screen the panel stays under the button and scrolls inside itself', async ({ page }) => {
  for (const size of [{ width: 1280, height: 700 }, { width: 390, height: 600 }]) {
    await page.setViewportSize(size);
    await page.goto('/en');
    const button = (await page.locator('.header-reading').boundingBox())!;
    const panel = await openPanel(page);
    const box = (await panel.boundingBox())!;
    expect(box.y, `${size.width}x${size.height}: below the button`).toBeGreaterThanOrEqual(button.y + button.height);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(await panel.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await panel.getByLabel('Typeface', { exact: true }).scrollIntoViewIfNeeded();
    await expect(panel.getByLabel('Typeface', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});
