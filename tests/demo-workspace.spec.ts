import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const willow = 'd0000000-0000-4000-8000-0000000000a1';
const pavilion = 'd0000000-0000-4000-8000-0000000000a2';
const stepName = (page: Page) => page.getByLabel('Step name', { exact: true }).first();

test('the demo opens the organisation app with a calm strip and a reset button', async ({ page }) => {
  await page.goto('/en/demo');
  const sidebar = page.getByRole('complementary', { name: 'Organisation' });
  await expect(sidebar.locator('.app-org-name')).toHaveText('Willow Museum (demo)');
  await expect(sidebar.locator('.app-org-role')).toHaveText('Owner');
  await expect(sidebar.getByRole('link', { name: 'Leave demo' })).toHaveAttribute('href', '/en/for-organisations');
  const strip = page.getByRole('region', { name: 'Demo · your changes stay in this browser' });
  await expect(strip.getByRole('button', { name: 'Reset demo' })).toBeVisible();
  // No sign-out form, and no organisation-only pages in the demo.
  await expect(sidebar.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Report a problem' })).toHaveCount(0);
});

test('the dashboard has a published museum with a QR code and an unfinished pavilion', async ({ page }) => {
  await page.goto('/en/demo');
  const cards = page.locator('.location-card');
  await expect(cards).toHaveCount(2);
  const museum = cards.filter({ hasText: 'The Willow Museum' });
  await expect(museum.locator('.status-badge')).toHaveText('Published');
  await expect(museum.locator('img.location-photo')).toHaveAttribute('src', /(illustrations|photos)\//);
  await expect(museum.getByText('Nothing needs attention.')).toBeVisible();
  await expect(museum.locator('.location-visits strong')).toHaveText('128');
  const pavilionCard = cards.filter({ hasText: 'Garden Pavilion' });
  await expect(pavilionCard.locator('.status-badge')).toHaveText('Draft');
  await expect(pavilionCard.getByText('Add at least 3 steps')).toBeVisible();
  await expect(pavilionCard.getByRole('button', { name: 'QR code and link' })).toHaveCount(0);

  await museum.getByRole('button', { name: 'QR code and link' }).click();
  const dialog = page.getByRole('dialog', { name: 'QR code and link' });
  await expect(dialog.locator('img.qr-image')).toHaveAttribute('src', '/api/qr/willow-museum');
  // Where /q/willow-museum leads is checked in tests/platform.spec.ts.
  await expect(dialog).toContainText('/q/willow-museum');
});

test('a change is kept in this browser, shows in the preview, and is not seen by anyone else', async ({ page, browser }) => {
  await page.goto(`/en/demo/${willow}`);
  await expect(stepName(page)).toHaveValue('The main entrance');
  await stepName(page).fill('The front door');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();
  await page.reload();
  await expect(stepName(page)).toHaveValue('The front door');

  await page.goto('/en/demo');
  await expect(page.locator('.location-card').first()).toBeVisible();
  await page.goto(`/en/demo/${willow}/preview`);
  await expect(page.getByRole('heading', { name: 'The front door', exact: true })).toBeVisible();

  // Another visitor (a separate browser profile) still sees the original.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`/en/demo/${willow}`);
  await expect(stepName(otherPage)).toHaveValue('The main entrance');
  await other.close();

  // The public example is untouched.
  await page.goto('/en/places/willow-museum/guide');
  await expect(page.getByRole('heading', { name: 'The main entrance', exact: true })).toBeVisible();

  // Reset brings the original back.
  await page.goto('/en/demo');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset the demo?' });
  await confirm.getByRole('button', { name: 'Reset demo' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.locator('.location-card')).toHaveCount(2);
  await page.goto(`/en/demo/${willow}`);
  await expect(stepName(page)).toHaveValue('The main entrance');
});

// Warnings on forms (docs/guides/ACCESSIBILITY.md, "Forms"): Save says which field needs filling, and opens a folded step to show it.
test('the editor marks each field that needs filling, in words, and opens a folded step to show it', async ({ page }) => {
  await page.goto(`/en/demo/${willow}`);
  const location = page.getByLabel('Location name', { exact: true });
  await location.fill('');
  await stepName(page).fill('');
  await page.getByRole('button', { name: /^Step 1/ }).click();
  await expect(stepName(page)).toBeHidden();
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(location).toBeFocused();
  await expect(location).toHaveAttribute('aria-invalid', 'true');
  await expect(location).toHaveAccessibleDescription('Fill in “Location name”.');
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toHaveCount(0);
  await location.fill('Willow Museum');
  await expect(location).not.toHaveAttribute('aria-invalid', 'true');
  // The step name sits in a folded step: Save opens it and goes there.
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(stepName(page)).toBeVisible();
  await expect(stepName(page)).toBeFocused();
  await expect(stepName(page)).toHaveAccessibleDescription('Fill in “Step name”.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await stepName(page).fill('The front door');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();
  // The words follow the page's language.
  await page.goto(`/de/demo/${willow}`);
  await page.getByLabel('Name des Ortes', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
  await expect(page.getByLabel('Name des Ortes', { exact: true })).toHaveAccessibleDescription('Füllen Sie „Name des Ortes“ aus.');
});

test('words are kept per language; levels and order are shared', async ({ page }) => {
  await page.goto(`/en/demo/${willow}`);
  await stepName(page).fill('The front door');
  await page.getByRole('radiogroup', { name: 'Sound', exact: true }).first().getByText('High', { exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();
  await page.goto(`/de/demo/${willow}`);
  await expect(stepName(page).or(page.getByLabel('Name des Schritts', { exact: true }).first())).toHaveValue('Der Haupteingang');
  await expect(page.getByRole('radiogroup', { name: 'Geräusche', exact: true }).first().getByLabel('Intensiv', { exact: true })).toBeChecked();
});

test('publishing is switched off, and nothing is sent to the server', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/workspace') || request.method() !== 'GET') sent.push(`${request.method()} ${url.pathname}`);
  });
  await page.goto('/en/demo');
  const publish = page.locator('.location-card').first().getByRole('button', { name: 'Publish' });
  await expect(publish).toHaveAttribute('aria-disabled', 'true');
  await publish.focus();
  await expect(page.getByRole('tooltip').filter({ hasText: 'Publishing is switched off in the demo.' }).first()).toBeVisible();
  await page.goto(`/en/demo/${pavilion}`);
  await stepName(page).fill('The garden gate');
  // It looks switched off and is: pressing it does nothing.
  await page.getByRole('button', { name: 'Publish' }).first().click({ force: true });
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();
  await page.goto(`/en/demo/${pavilion}/preview`);
  await expect(page.getByRole('heading', { name: 'The garden gate', exact: true })).toBeVisible();
  expect(sent).toEqual([]);
});

test('a photo added in the demo stays in this browser', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (request) => { if (request.method() !== 'GET') sent.push(request.url()); });
  await page.goto(`/en/demo/${pavilion}`);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#356050';
    context.fillRect(0, 0, 160, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  // The first step has no photo; the second step (with the sample one) is folded.
  const photo = page.locator('.photo-editor').first();
  await photo.locator('input[type=file]').setInputFiles({ name: 'path.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(photo.getByText('Photo added on this device.')).toBeVisible();
  await photo.getByLabel('Image description (alternative text)').fill('A gravel path between willow trees.');
  await photo.getByLabel('Image rights / credit', { exact: true }).fill('Our own photograph');
  await photo.getByLabel('Date photographed', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser.' })).toBeVisible();
  await page.goto(`/en/demo/${pavilion}/preview`);
  await expect(page.getByRole('img', { name: 'A gravel path between willow trees.', exact: true })).toHaveAttribute('src', /^blob:/);
  // Reset removes it again.
  await page.goto('/en/demo');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset the demo?' });
  await confirm.getByRole('button', { name: 'Reset demo' }).click();
  await expect(confirm).toBeHidden();
  await page.goto(`/en/demo/${pavilion}/preview`);
  await expect(page.getByRole('img', { name: 'A gravel path between willow trees.', exact: true })).toHaveCount(0);
  expect(sent).toEqual([]);
});

test('photo validation in the demo rejects SVG, a forged raster and oversized files', async ({ page }) => {
  await page.goto(`/en/demo/${pavilion}`);
  const photo = page.locator('.photo-editor').first();
  const input = photo.locator('input[type=file]');
  for (const file of [
    { name: 'script.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg onload="alert(1)"></svg>') },
    { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
    { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]) {
    await input.setInputFiles(file);
    await expect(photo.getByRole('alert')).toHaveText('Choose a valid JPEG, PNG or WebP image of no more than 5 MB.');
  }
  await expect(photo.getByLabel('Image description (alternative text)')).toHaveCount(0);
});

test('a damaged stored value falls back to the original', async ({ page }) => {
  await page.goto(`/en/demo/${willow}`);
  await page.evaluate((id) => localStorage.setItem(`neruma:demo:v1:${id}`, '{"v":1,"shared":null}'), willow);
  await page.reload();
  await expect(stepName(page)).toHaveValue('The main entrance');
});

test('the old dashboard addresses lead to the demo, in every language', async ({ request }) => {
  for (const locale of ['en', 'ro', 'de']) {
    for (const path of ['dashboard', 'dashboard/builder', 'dashboard/preview', 'dashboard/share']) {
      const response = await request.get(`/${locale}/${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(308);
      expect(response.headers().location).toBe(`/${locale}/demo`);
    }
  }
});

test('an address that is not a demo location is not found', async ({ page }) => {
  expect((await page.goto(`/en/demo/${crypto.randomUUID()}`))?.status()).toBe(404);
});

test('the preview is a phone-shaped screen on a large window and the page itself on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/en/demo/${willow}/preview`);
  const screen = page.locator('.draft-device');
  await expect(screen).toBeVisible();
  const box = (await screen.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(440);
  expect(box.height / box.width).toBeGreaterThan(2.05);
  await page.setViewportSize({ width: 390, height: 800 });
  expect((await screen.boundingBox())!.width).toBeGreaterThan(340);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the demo works at 390px and 320px without sideways scrolling', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/en/demo', `/en/demo/${willow}`, `/en/demo/${willow}/preview`]) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px ${path}`).toBe(true);
    }
  }
});

for (const theme of ['dark', 'light', 'contrast']) {
  test(`the demo passes the accessibility checks in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('vianorae:reading:v1', JSON.stringify({ theme: value, themeV: 2 })), theme);
    for (const path of ['/en/demo', `/en/demo/${willow}`, `/en/demo/${willow}/preview`]) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('main [role="status"]').filter({ hasText: 'Loading' })).toHaveCount(0);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, path).toEqual([]);
    }
  });
}
