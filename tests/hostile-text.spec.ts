import { expect, test, type Page } from '@playwright/test';

// Organisations type the text visitors read. The demo workspace is the real organisation app saved in the browser, so
// attack strings typed into it go through the real editor, storage and preview with no mocked data. Whatever is typed
// must come out as plain text: no script runs, no element appears, no handler fires.

const willow = 'd0000000-0000-4000-8000-0000000000a1';
const hostile = [
  '<img src=x onerror="window.__xss=1">',
  '"><script>window.__xss=2</script>',
  "'; window.__xss=3; //",
  '<svg onload="window.__xss=4">',
  '<a href="javascript:window.__xss=5">click</a>',
  '{{constructor.constructor("window.__xss=6")()}}',
  '${window.__xss=7}',
  '</title><script>window.__xss=8</script>',
  '<iframe src="javascript:window.__xss=9"></iframe>',
  '‮txet desrever‬ <b>bold</b> \u0000 null',
];

const stepName = (page: Page) => page.getByLabel('Step name', { exact: true }).first();

for (const text of hostile) {
  test(`typed as plain text and shown as plain text: ${text.slice(0, 32)}`, async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.goto(`/en/demo/${willow}`);
    await stepName(page).fill(text);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();

    // The preview comes last, so the check after the loop reads the page that is already open.
    for (const path of [`/en/demo/${willow}`, '/en/demo', `/en/demo/${willow}/preview`]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), `${path}: a script ran`).toBeUndefined();
      expect(dialogs, `${path}: a dialog opened`).toEqual([]);
      // No element was made from the text: no extra images, frames, scripts or handlers in the page body.
      expect(await page.locator('main img[src="x"], main svg[onload], main iframe, main script').count(), `${path}: an element was made from the text`).toBe(0);
      expect(await page.locator('main [onerror], main [onload], main [onclick]').count(), `${path}: an event handler was added`).toBe(0);
      expect(await page.locator('main a[href^="javascript:"]').count(), `${path}: a script link appeared`).toBe(0);
    }
    // The preview shows the characters themselves, not something made of them.
    if (text.startsWith('<img') || text.startsWith('<svg') || text.startsWith('<a ')) {
      await expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible();
    }
  });
}

test('a very long name and a name of only spaces cannot break the page or be saved empty', async ({ page }) => {
  await page.goto(`/en/demo/${willow}`);
  await stepName(page).fill('x'.repeat(5000));
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.goto(`/en/demo/${willow}/preview`);
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'a long name scrolls the page sideways').toBe(true);
  await page.goto(`/en/demo/${willow}`);
  await stepName(page).fill('     ');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.reload();
  await expect(stepName(page)).not.toHaveValue('     ');
});

test('a stored value that someone edited by hand in the browser cannot run anything either', async ({ page }) => {
  await page.goto('/en/demo');
  await page.evaluate((id) => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('neruma:demo:v1:')) ?? `neruma:demo:v1:${id}`;
    localStorage.setItem(key, '{"name":"<img src=x onerror=window.__xss=1>","zones":"not a list","__proto__":{"polluted":true}}');
  }, willow);
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(`/en/demo/${willow}/preview`);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.evaluate(() => ({} as Record<string, unknown>).polluted)).toBeUndefined();
  expect(dialogs).toEqual([]);
  await expect(page.locator('main')).toBeVisible();
});
