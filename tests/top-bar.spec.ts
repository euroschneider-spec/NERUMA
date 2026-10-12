import { expect, test, type Page } from '@playwright/test';

const bar = (page: Page) => page.locator('.topbar');
const openPanel = async (page: Page) => {
  await page.locator('.topbar-reading').click();
  return page.getByRole('dialog');
};

test('the top bar has three controls: language, light or dark, and the reading panel', async ({ page }) => {
  await page.goto('/en/methodology');
  await expect(bar(page).locator('.language-switch summary')).toBeVisible();
  await expect(bar(page).getByRole('button', { name: 'Switch to light mode', exact: true })).toBeVisible();
  await expect(bar(page).getByRole('button', { name: 'Reading settings', exact: true })).toBeVisible();
  await expect(bar(page).getByRole('button')).toHaveCount(2);
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

test('on a phone the three controls fit on one row, and the panel opens fully on screen', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/en');
    const boxes = await bar(page).locator('.language-switch summary, .theme-toggle, .topbar-reading').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), right: r.right }; }));
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes.map((b) => b.y)).size, `${width}px: one row`).toBe(1);
    expect(new Set(boxes.map((b) => b.h)).size, `${width}px: same height`).toBe(1);
    expect(Math.max(...boxes.map((b) => b.right))).toBeLessThanOrEqual(width);
    const panel = await openPanel(page);
    const r = (await panel.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
  }
});

test('on a short screen the panel stays under the button and scrolls inside itself', async ({ page }) => {
  for (const size of [{ width: 1280, height: 700 }, { width: 390, height: 600 }]) {
    await page.setViewportSize(size);
    await page.goto('/en');
    const button = (await page.locator('.topbar-reading').boundingBox())!;
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
