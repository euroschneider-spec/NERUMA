import { test, expect, type Page } from '@playwright/test';

// What a visitor's browser receives and keeps, checked against the real production build with no mocked data.
// The privacy page promises: no analytics, no third parties, nothing stored until the visitor changes a setting
// (docs/planning/TECH-TASKS.md §3). These tests make that promise something that fails when it stops being true.

const publicPages = [
  '/en', '/ro', '/de', '/en/for-organisations', '/en/methodology', '/en/places/willow-museum/guide', '/ro/places/willow-museum/guide',
  '/en/explore', '/en/contact', '/en/login', '/en/register', '/en/privacy', '/en/terms', '/en/accessibility', '/en/guide-unavailable',
];

const deviceState = (page: Page) => page.evaluate(async () => ({
  local: Object.keys(localStorage),
  session: Object.keys(sessionStorage),
  databases: ((await indexedDB.databases?.()) ?? []).map((database) => database.name),
}));

test.describe('a first visit', () => {
  // One visit per page answers all three questions: waiting for the network to go quiet is the slow part.
  for (const path of publicPages) {
    test(`${path}: sets no cookie, stores nothing, talks only to the site and loads no tracker or embed`, async ({ page, context, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const outside: string[] = [];
      const markup: Promise<string>[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin) outside.push(url);
      });
      page.on('response', (response) => {
        const type = response.headers()['content-type'] ?? '';
        if (/html|javascript/.test(type)) markup.push(response.text().catch(() => ''));
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await context.cookies()).toEqual([]);
      expect(await deviceState(page)).toEqual({ local: [], session: [], databases: [] });
      expect(outside).toEqual([]);
      const all = (await Promise.all(markup)).join('\n');
      expect(all).not.toMatch(/googletagmanager|google-analytics|gtag\(|plausible\.io|matomo|hotjar|fullstory|clarity\.ms|posthog|mixpanel|facebook\.net|connect\.facebook/i);
      expect(all).not.toMatch(/<iframe\b/i);
    });
  }
});

test('changing a reading setting stores one named key on the device and no cookie', async ({ page, context }) => {
  await page.goto('/en');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const state = await deviceState(page);
  expect(state.local).toEqual(['vianorae:reading:v1']);
  expect(state.session).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  // What is stored is a few display choices and nothing about the person.
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('vianorae:reading:v1') ?? '{}'));
  expect(Object.keys(stored).sort()).toEqual(expect.arrayContaining(['theme']));
  expect(JSON.stringify(stored)).not.toMatch(/@|name|email|token|ip/i);
});

test.describe('security headers', () => {
  test('every page is served with the protective headers', async ({ request }) => {
    for (const path of ['/en', '/en/login', '/en/places/willow-museum/guide', '/en/nothing-here']) {
      const response = await request.get(path);
      const headers = response.headers();
      expect(headers['x-frame-options'], path).toBe('DENY');
      expect(headers['x-content-type-options'], path).toBe('nosniff');
      expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy'], path).toBe('camera=(), microphone=(), geolocation=()');
      expect(headers['strict-transport-security'], path).toContain('max-age=');
      expect(headers['x-powered-by'], path).toBeUndefined();
    }
  });

  test('the content policy blocks other origins, framing, plugins, forged forms and eval', async ({ request }) => {
    const policy = (await request.get('/en')).headers()['content-security-policy'];
    expect(policy).toBeDefined();
    const directives = Object.fromEntries(policy.split(';').map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
    for (const [name, values] of Object.entries(directives)) {
      expect(values.filter((value) => /^https?:|^\*$/.test(value)), `${name} allows another origin`).toEqual([]);
    }
  });

  test('private pages tell search engines to stay away', async ({ page }) => {
    for (const path of ['/en/login', '/en/register', '/en/account']) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', /noindex/);
    }
  });
});

test.describe('hostile requests', () => {
  // Known: Next sometimes also serves a page at a differently-capitalised address (/EN/terms). Harmless; see docs/guides/TEST-PLAN.md.
  test('an unknown language is not found on every kind of page', async ({ request }) => {
    for (const path of ['/xx', '/xx/login', '/xx/account', '/xx/privacy', '/xx/places/willow-museum/guide', '/%00/login', '/../login']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([308, 404], path).toContain(response.status());
    }
  });

  test('odd QR codes and guide addresses are plain 404s that show no code, stack or name', async ({ request }) => {
    const odd = ['%00', 'A', 'a'.repeat(300), "'%3Bdrop%20table%20places%3B--", '%3Cscript%3Ealert(1)%3C%2Fscript%3E', '..%2F..%2Fetc%2Fpasswd', 'willow%20museum', '-', 'a--b'];
    for (const code of odd) {
      const qr = await request.get(`/q/${code}`, { maxRedirects: 0 });
      expect(qr.status(), `/q/${code}`).toBe(404);
      const body = await qr.text();
      expect(body).not.toMatch(/at \w+ \(|node_modules|supabase|postgres|Error:/i);
      const guide = await request.get(`/en/places/${code}/guide`);
      expect(guide.status(), `guide ${code}`).toBe(404);
      expect(await guide.text()).not.toMatch(/at \w+ \(|node_modules|postgres/i);
    }
  });

  test('the photo address refuses anything that is not an exact key, with no detail', async ({ request }) => {
    const id = '00000000-0000-4000-8000-000000000001';
    const bad = ['', 'x', `${id}/${id}/${id}/${id}.png`, `../${id}/${id}/${id}/${id}.webp`, `${id}/${id}/${id}/${id}.webp/..`, `${id.toUpperCase()}/${id}/${id}/${id}.webp`, `${id}/${id}/${id}.webp`, `${id}/${id}/${id}/${id}/${id}.webp`, `${id}/${id}/${id}/${id}.webp\n`];
    for (const key of bad) {
      const response = await request.get(`/api/guide-photos?key=${encodeURIComponent(key)}`);
      expect(response.status(), key).toBe(404);
      expect(await response.text()).toBe('Not found');
    }
    const missing = await request.get(`/api/guide-photos?key=${encodeURIComponent(`${id}/${id}/${id}/${id}.webp`)}`);
    expect(missing.status()).toBe(404);
    expect(missing.headers()['cache-control']).toBe('no-store');
  });

  test('private routes answer a signed-out caller with a refusal, never data', async ({ request }) => {
    for (const path of ['/api/workspace/photos?key=anything', '/api/verification/documents?id=00000000-0000-4000-8000-000000000001']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([401, 403, 404], path).toContain(response.status());
      expect(response.headers()['content-type'] ?? '').not.toMatch(/image|pdf/);
    }
    for (const path of ['/en/workspace', '/en/admin', '/en/admin/organisations', '/en/admin/reports', '/en/admin/accounts', '/en/admin/administrators', '/en/login/verify']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([307, 308, 404], path).toContain(response.status());
    }
  });

  test('a cross-site form post cannot reach the QR or photo routes with side effects', async ({ request }) => {
    for (const path of ['/q/willow-museum', '/api/guide-photos', '/api/qr/willow-museum']) {
      const response = await request.post(path, { data: { x: 1 }, maxRedirects: 0 });
      expect([404, 405], path).toContain(response.status());
    }
  });
});
