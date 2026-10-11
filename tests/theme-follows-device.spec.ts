import { expect, test } from '@playwright/test';

const key = 'vianorae:reading:v1';
const theme = (page: import('@playwright/test').Page) => page.locator('html').getAttribute('data-theme');

test.describe('a visitor who has not chosen follows the device', () => {
  test('light device shows light, dark device shows dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the theme is right before the page scripts load, so a light device never flashes dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto('/en');
    expect(await theme(page)).toBe('light');
  });

  test('switching the device while the page is open changes the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('changing another setting does not turn the device default into a stored choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en');
    await page.locator('.floating-reading').click();
    await page.getByLabel('Text size', { exact: true }).selectOption('larger');
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), key);
    expect(stored.size).toBe('larger');
    expect(stored.theme).toBe('system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('a visitor who chose keeps the choice', () => {
  test('an explicit theme ignores the device, and Match my device brings it back', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en');
    await page.locator('.floating-reading').click();
    const appearance = page.getByLabel('Appearance', { exact: true });
    await expect(appearance).toHaveValue('system');
    await appearance.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.floating-reading').click();
    await page.getByLabel('Appearance', { exact: true }).selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('a theme saved by the older version follows the device again, once', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((k) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ theme: 'dark', size: 'larger' })); }, key);
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
    await page.locator('.floating-reading').click();
    await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('system');
  });

  test('a theme saved by this version is kept', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ theme: 'dark', themeV: 2 })), key);
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
